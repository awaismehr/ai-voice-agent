import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, type MessageRole } from './message.entity.js';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
  ) {}

  getHistory(conversationId: string): Promise<Message[]> {
    return this.messages.find({
      where: { conversationId },
      order: { id: 'ASC' },
    });
  }

  append(
    conversationId: string,
    role: MessageRole,
    content: string,
  ): Promise<Message> {
    return this.messages.save(
      this.messages.create({ conversationId, role, content }),
    );
  }

  async reset(conversationId: string): Promise<void> {
    await this.messages.delete({ conversationId });
  }
}
