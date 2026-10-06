import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type MessageRole = 'user' | 'assistant';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'text' })
  conversationId: string;

  @Column({ type: 'text' })
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
