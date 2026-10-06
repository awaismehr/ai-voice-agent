import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { VoiceController } from './voice.controller.js';

@Module({
  imports: [AiModule, ConversationModule],
  controllers: [VoiceController],
})
export class VoiceModule {}
