import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  APICallError,
  LoadAPIKeyError,
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
  type UIMessageChunk,
} from 'ai';
import type { ServerResponse } from 'node:http';
import aiConfig from '../../config/ai.config.js';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamReplyOptions {
  history: ChatTurn[];
  persona?: PersonaId;
  onFinish?: (text: string) => void | Promise<void>;
}

@Injectable()
export class AiService {
  /** Kokoro voices (`hexgrad/kokoro-82m`). Mirrored, with labels, in the frontend. */
  static readonly VOICES = [
    'af_heart',
    'af_bella',
    'af_nova',
    'af_sky',
    'am_adam',
    'am_onyx',
    'bf_emma',
    'bm_george',
  ] as const;

  static readonly PERSONAS = {
    assistant: {
      label: 'Friendly assistant',
      prompt: 'You are a warm, curious, and helpful assistant.',
    },
    tutor: {
      label: 'Patient tutor',
      prompt:
        'You are a patient tutor. Explain ideas simply with a concrete example, then check understanding with a short question.',
    },
    pirate: {
      label: 'Pirate captain',
      prompt:
        'You are a jovial pirate captain. Stay helpful and accurate, but speak in playful pirate slang.',
    },
    coach: {
      label: 'Motivational coach',
      prompt:
        'You are an upbeat motivational coach. Be encouraging, practical, and brief.',
    },
  } as const;

  static readonly PERSONA_IDS = Object.keys(AiService.PERSONAS) as PersonaId[];

  private static readonly DEFAULT_VOICE: Voice = 'af_heart';
  private static readonly DEFAULT_PERSONA: PersonaId = 'assistant';

  /**
   * Every reply is read aloud, so the base prompt forbids anything that sounds
   * wrong when spoken (markdown, lists, URLs) and keeps answers short.
   */
  private static readonly SPOKEN_STYLE = [
    'You are speaking out loud in a voice conversation.',
    'Reply in one to three short, natural sentences.',
    'Never use markdown, bullet points, emojis, code blocks, or URLs.',
    'If the user asks for something long, give a brief spoken summary and offer to continue.',
  ].join(' ');

  private readonly logger = new Logger(AiService.name);
  private readonly provider;

  constructor(
    @Inject(aiConfig.KEY) private readonly config: ConfigType<typeof aiConfig>,
  ) {
    this.provider = createOpenRouter({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  /** Speech → text. `mimeType` is the browser's recording type (webm, mp4, …). */
  async transcribe(audio: Uint8Array, mimeType = 'audio/webm'): Promise<string> {
    if (audio.byteLength === 0) {
      throw new HttpException(
        'The recording was empty.',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const response = await this.post('/audio/transcriptions', {
        model: this.config.models.transcription,
        input_audio: {
          data: Buffer.from(audio).toString('base64'),
          format: AiService.audioFormatOf(mimeType),
        },
      });
      const { text } = (await response.json()) as { text: string };
      return text.trim();
    } catch (error) {
      throw this.toHttpException(error, 'Could not transcribe the audio.');
    }
  }

  /**
   * Streams the assistant's reply as an AI SDK UI-message stream, which
   * `useChat` on the client consumes directly.
   */
  streamReply({
    history,
    persona = AiService.DEFAULT_PERSONA,
    onFinish,
  }: StreamReplyOptions): ReadableStream<UIMessageChunk> {
    const result = streamText({
      // DeepSeek V4 "thinks" first by default, which adds dead air to a voice reply.
      model: this.provider.chat(this.config.models.chat, {
        extraBody: { reasoning: { enabled: false } },
      }),
      system: this.systemPrompt(persona),
      messages: history,
      onFinish: async ({ text }) => {
        if (text) await onFinish?.(text);
      },
    });

    // Keep generating (and so persisting via onFinish) even if the client disconnects.
    void result.consumeStream();

    return toUIMessageStream({
      stream: result.stream,
      // Errors raised mid-stream reach the client as a chunk; keep it readable.
      onError: (error) =>
        this.toHttpException(error, 'The reply failed.').message,
    });
  }

  /** Writes a UI-message stream to a raw Node response (Nest's `@Res()`). */
  pipeToResponse(
    response: ServerResponse,
    stream: ReadableStream<UIMessageChunk>,
  ) {
    return pipeUIMessageStreamToResponse({ response, stream });
  }

  /** Text → spoken audio (mp3 bytes). */
  async speak(
    text: string,
    voice: Voice = AiService.DEFAULT_VOICE,
  ): Promise<Uint8Array> {
    try {
      const response = await this.post('/audio/speech', {
        model: this.config.models.speech,
        input: text,
        voice,
        response_format: 'mp3',
      });
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      throw this.toHttpException(error, 'Could not generate speech.');
    }
  }

  /** Maps a recording's MIME type to the format name OpenRouter expects. */
  private static audioFormatOf(mimeType: string): string {
    const type = mimeType.toLowerCase();
    if (type.includes('webm')) return 'webm';
    if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('wav')) return 'wav';
    if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
    return 'webm';
  }

  /**
   * OpenRouter's audio endpoints aren't covered by the AI SDK provider, so they
   * are plain JSON POSTs. Failures become `APICallError`s so they share the
   * status-code handling in `toHttpException` with the SDK's own calls.
   */
  private async post(path: string, body: unknown): Promise<Response> {
    const { apiKey, baseUrl } = this.config;
    if (!apiKey) {
      throw new LoadAPIKeyError({ message: 'OPENROUTER_API_KEY is not set.' });
    }
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new APICallError({
        message: `OpenRouter ${path} failed with ${response.status}`,
        url,
        requestBodyValues: {},
        statusCode: response.status,
        responseBody: await response.text(),
      });
    }
    return response;
  }

  private systemPrompt(persona: PersonaId): string {
    return `${AiService.PERSONAS[persona].prompt} ${AiService.SPOKEN_STYLE}`;
  }

  private toHttpException(error: unknown, fallback: string): HttpException {
    if (error instanceof HttpException) return error;
    this.logger.error(error instanceof Error ? error.message : String(error));

    if (LoadAPIKeyError.isInstance(error)) {
      return new HttpException(
        'OPENROUTER_API_KEY is not set on the server. Add it to backend/.env and restart.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (APICallError.isInstance(error)) {
      switch (error.statusCode) {
        case 401:
          return new HttpException(
            'OpenRouter rejected the API key. Check OPENROUTER_API_KEY on the server.',
            HttpStatus.BAD_GATEWAY,
          );

        case 402:
          return new HttpException(
            'OpenRouter credits are exhausted. Add credits at openrouter.ai.',
            HttpStatus.PAYMENT_REQUIRED,
          );

        case 429:
          return new HttpException(
            'OpenRouter rate limit reached. Wait a moment and try again.',
            HttpStatus.TOO_MANY_REQUESTS,
          );

        case 400:
          return new HttpException(
            `${fallback} OpenRouter could not process the request.`,
            HttpStatus.BAD_REQUEST,
          );
      }
    }
    return new HttpException(fallback, HttpStatus.BAD_GATEWAY);
  }
}

export type Voice = (typeof AiService.VOICES)[number];
export type PersonaId = keyof typeof AiService.PERSONAS;
