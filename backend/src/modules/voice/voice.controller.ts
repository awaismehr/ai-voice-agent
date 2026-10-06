import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { AudioUploadInterceptor } from './interceptors/audio-upload.interceptor.js';
import { RespondDto } from './dto/respond.dto.js';
import { SpeakDto } from './dto/speak.dto.js';
import { TranscribeResponseDto } from './dto/transcribe.dto.js';
import { AiService } from '../ai/ai.service.js';
import { ConversationService } from '../conversation/conversation.service.js';

@Controller()
export class VoiceController {
  constructor(
    private readonly ai: AiService,
    private readonly conversations: ConversationService,
  ) {}

  @Post('transcribe')
  @UseInterceptors(AudioUploadInterceptor)
  async transcribe(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<TranscribeResponseDto> {
    if (!file) throw new BadRequestException('Missing "audio" file field.');
    return { text: await this.ai.transcribe(file.buffer, file.mimetype) };
  }

  /**
   * Persists the user's message, then streams the assistant's reply. `@Res()`
   * opts out of Nest's serialization: the AI SDK writes the response itself.
   */
  @Post('respond')
  async respond(@Body() dto: RespondDto, @Res() res: Response): Promise<void> {
    const { conversationId, message, persona } = dto;

    await this.conversations.append(conversationId, 'user', message);
    const history = await this.conversations.getHistory(conversationId);

    const stream = this.ai.streamReply({
      history: history.map(({ role, content }) => ({ role, content })),
      persona,
      onFinish: (text) => {
        void this.conversations.append(conversationId, 'assistant', text);
      },
    });
    await this.ai.pipeToResponse(res, stream);
  }

  @Post('speak')
  @HttpCode(200)
  async speak(@Body() dto: SpeakDto, @Res() res: Response): Promise<void> {
    const audio = await this.ai.speak(dto.text, dto.voice);
    res.type('audio/mpeg').send(Buffer.from(audio));
  }

  @Get('conversation/:id')
  getConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.getHistory(id);
  }

  @Delete('conversation/:id')
  @HttpCode(204)
  async resetConversation(@Param('id', ParseUUIDPipe) id: string) {
    await this.conversations.reset(id);
  }
}
