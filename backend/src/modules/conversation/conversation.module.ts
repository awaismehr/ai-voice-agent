import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationService } from './conversation.service.js';
import { Message } from './message.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Message])],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
