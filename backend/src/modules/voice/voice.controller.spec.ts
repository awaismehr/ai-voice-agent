import type { Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import type { AiService } from '../ai/ai.service.js';
import type { ConversationService } from '../conversation/conversation.service.js';
import { VoiceController } from './voice.controller.js';

const ID = '3f2b8c1e-5a47-4d9e-9b1a-7c6d5e4f3a21';

describe('VoiceController', () => {
  let ai: {
    transcribe: Mock;
    speak: Mock;
    streamReply: Mock;
    pipeToResponse: Mock;
  };
  let conversations: { append: Mock; getHistory: Mock; reset: Mock };
  let controller: VoiceController;
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    ai = {
      transcribe: vi.fn().mockResolvedValue('hello'),
      speak: vi.fn().mockResolvedValue(new Uint8Array([1, 2])),
      streamReply: vi.fn((opts) => {
        calls.push('model');
        return { opts };
      }),
      pipeToResponse: vi.fn().mockResolvedValue(undefined),
    };
    conversations = {
      append: vi.fn(async () => void calls.push('append')),
      getHistory: vi.fn().mockResolvedValue([
        {
          id: 1,
          conversationId: ID,
          role: 'user',
          content: 'hi',
          createdAt: new Date(),
        },
      ]),
      reset: vi.fn().mockResolvedValue(undefined),
    };
    controller = new VoiceController(
      ai as unknown as AiService,
      conversations as unknown as ConversationService,
    );
  });

  describe('POST /transcribe', () => {
    it('returns the transcribed text', async () => {
      const file = {
        buffer: Buffer.from([1]),
        mimetype: 'audio/webm',
      } as Express.Multer.File;
      await expect(controller.transcribe(file)).resolves.toEqual({
        text: 'hello',
      });
    });

    it('rejects a request without an audio file', async () => {
      await expect(controller.transcribe(undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('POST /respond', () => {
    it('persists the user message before the model is called', async () => {
      const res = {} as Response;
      await controller.respond(
        { conversationId: ID, message: 'hi', persona: 'tutor' },
        res,
      );

      expect(calls[0]).toBe('append');
      expect(calls.indexOf('append')).toBeLessThan(calls.indexOf('model'));
      expect(conversations.append).toHaveBeenCalledWith(ID, 'user', 'hi');
    });

    it('sends stored history plus persona to the model and pipes the stream', async () => {
      const res = {} as Response;
      await controller.respond(
        { conversationId: ID, message: 'hi', persona: 'tutor' },
        res,
      );

      const opts = ai.streamReply.mock.calls[0][0];
      expect(opts.history).toEqual([{ role: 'user', content: 'hi' }]);
      expect(opts.persona).toBe('tutor');
      expect(ai.pipeToResponse).toHaveBeenCalledWith(
        res,
        ai.streamReply.mock.results[0].value,
      );
    });

    it('persists the finished assistant text', async () => {
      await controller.respond(
        { conversationId: ID, message: 'hi' },
        {} as Response,
      );

      ai.streamReply.mock.calls[0][0].onFinish('hello back');

      expect(conversations.append).toHaveBeenLastCalledWith(
        ID,
        'assistant',
        'hello back',
      );
    });
  });

  describe('POST /speak', () => {
    it('sends mpeg audio bytes', async () => {
      const res = { type: vi.fn().mockReturnThis(), send: vi.fn() };

      await controller.speak(
        { text: 'hi', voice: 'af_nova' },
        res as unknown as Response,
      );

      expect(ai.speak).toHaveBeenCalledWith('hi', 'af_nova');
      expect(res.type).toHaveBeenCalledWith('audio/mpeg');
      expect(res.send).toHaveBeenCalledWith(Buffer.from([1, 2]));
    });
  });

  describe('conversation endpoints', () => {
    it('GET returns stored history', async () => {
      await expect(controller.getConversation(ID)).resolves.toHaveLength(1);
      expect(conversations.getHistory).toHaveBeenCalledWith(ID);
    });

    it('DELETE resets that conversation', async () => {
      await controller.resetConversation(ID);
      expect(conversations.reset).toHaveBeenCalledWith(ID);
    });
  });
});
