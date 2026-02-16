import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service.js';
import { MessageService } from './message.service.js';

@Module({
  providers: [ConversationService, MessageService],
  exports: [ConversationService, MessageService],
})
export class ConversationModule {}
