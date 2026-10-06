import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { UIMessageChunk } from 'ai';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { AiService } from './ai.service.js';

// The provider is the only thing replaced: `.chat()` resolves to a mock model.
const provider = vi.hoisted(() => ({
  model: undefined as unknown,
  chat: vi.fn(),
}));
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: () => ({
    chat: (...args: unknown[]) => {
      provider.chat(...args);
      return provider.model;
    },
  }),
}));

const config = {
  apiKey: 'sk-or-test',
  baseUrl: 'https://openrouter.test/api/v1',
  models: { chat: 'chat/model', transcription: 'stt/model', speech: 'tts/model' },
};

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function mockModel(deltas: string[]) {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start', id: 't' },
          ...deltas.map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
        ],
      }),
    }),
  });
  provider.model = model;
  return model;
}

async function readAll(stream: ReadableStream<UIMessageChunk>) {
  const chunks: UIMessageChunk[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<UIMessageChunk>) {
    chunks.push(chunk);
  }
  return chunks;
}

const fetchMock = vi.fn();
const reply = (body: BodyInit, status = 200) => new Response(body, { status });

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', fetchMock);
    service = new AiService(config);
  });

  afterEach(() => vi.unstubAllGlobals());

  describe('streamReply', () => {
    it('streams the reply and reports the full text once finished', async () => {
      mockModel(['Hello', ' world']);
      const onFinish = vi.fn();

      const chunks = await readAll(
        service.streamReply({ history: [{ role: 'user', content: 'hi' }], onFinish }),
      );

      const deltas = chunks.filter((c) => c.type === 'text-delta');
      expect(deltas.map((c) => (c as { delta: string }).delta)).toEqual([
        'Hello',
        ' world',
      ]);
      expect(onFinish).toHaveBeenCalledExactlyOnceWith('Hello world');
    });

    it('uses the configured chat model with reasoning switched off', async () => {
      mockModel(['ok']);

      await readAll(service.streamReply({ history: [{ role: 'user', content: 'hi' }] }));

      expect(provider.chat).toHaveBeenCalledWith('chat/model', {
        extraBody: { reasoning: { enabled: false } },
      });
    });

    it('sends the persona prompt and the history to the model', async () => {
      const model = mockModel(['ok']);

      await readAll(
        service.streamReply({
          history: [
            { role: 'user', content: 'one' },
            { role: 'assistant', content: 'two' },
            { role: 'user', content: 'three' },
          ],
          persona: 'pirate',
        }),
      );

      const prompt = model.doStreamCalls[0].prompt;
      expect(prompt[0].role).toBe('system');
      expect(prompt[0].content).toContain(AiService.PERSONAS.pirate.prompt);
      expect(prompt[0].content).toContain('speaking out loud');
      expect(prompt.slice(1).map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    });
  });

  describe('transcribe', () => {
    it('posts base64 audio in the right format and returns trimmed text', async () => {
      fetchMock.mockResolvedValue(reply(JSON.stringify({ text: '  hello  ' })));

      await expect(
        service.transcribe(new Uint8Array([1, 2, 3]), 'audio/webm;codecs=opus'),
      ).resolves.toBe('hello');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://openrouter.test/api/v1/audio/transcriptions');
      expect(init.headers.Authorization).toBe('Bearer sk-or-test');
      expect(JSON.parse(init.body)).toEqual({
        model: 'stt/model',
        input_audio: { data: Buffer.from([1, 2, 3]).toString('base64'), format: 'webm' },
      });
    });

    it.each([
      ['audio/mp4', 'm4a'],
      ['audio/ogg', 'ogg'],
      ['audio/wav', 'wav'],
      ['audio/mpeg', 'mp3'],
    ])('maps %s to the %s format', async (mimeType, format) => {
      fetchMock.mockResolvedValue(reply(JSON.stringify({ text: 'x' })));
      await service.transcribe(new Uint8Array([1]), mimeType);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).input_audio.format).toBe(format);
    });

    it('rejects an empty recording without calling OpenRouter', async () => {
      await expect(service.transcribe(new Uint8Array())).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('translates a rejected key into a readable HttpException', async () => {
      fetchMock.mockResolvedValue(reply('nope', 401));
      const error = await service.transcribe(new Uint8Array([1])).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).message).toMatch(/API key/);
    });

    it('reports exhausted credits as 402', async () => {
      fetchMock.mockResolvedValue(reply('no credits', 402));
      const error = await service.transcribe(new Uint8Array([1])).catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect((error as HttpException).message).toMatch(/credits/i);
    });

    it('explains a missing API key instead of calling out', async () => {
      const unconfigured = new AiService({ ...config, apiKey: undefined });
      const error = await unconfigured.transcribe(new Uint8Array([1])).catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('speak', () => {
    it('returns the raw audio bytes for the chosen voice', async () => {
      fetchMock.mockResolvedValue(reply(new Uint8Array([9, 9])));

      await expect(service.speak('hi', 'am_onyx')).resolves.toEqual(new Uint8Array([9, 9]));

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://openrouter.test/api/v1/audio/speech');
      expect(JSON.parse(init.body)).toEqual({
        model: 'tts/model',
        input: 'hi',
        voice: 'am_onyx',
        response_format: 'mp3',
      });
    });

    it('falls back to the default voice', async () => {
      fetchMock.mockResolvedValue(reply(new Uint8Array([1])));
      await service.speak('hi');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).voice).toBe('af_heart');
    });

    it('maps rate limiting to a 429', async () => {
      fetchMock.mockResolvedValue(reply('slow down', 429));
      const error = await service.speak('hi').catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });
});
