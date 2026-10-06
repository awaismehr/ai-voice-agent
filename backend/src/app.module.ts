import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import aiConfig from './config/ai.config.js';
import appConfig from './config/app.config.js';
import { ConversationModule } from './modules/conversation/conversation.module.js';
import { Message } from './modules/conversation/message.entity.js';
import { VoiceModule } from './modules/voice/voice.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig, aiConfig] }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'data/app.sqlite',
      entities: [Message],
      synchronize: true,
    }),
    ConversationModule,
    VoiceModule,
  ],
})
export class AppModule {}
