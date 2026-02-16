import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service.js';
import { ResponseQueueProcessor } from './queues/response-queue.processor.js';
import { TypingQueueProcessor } from './queues/typing-queue.processor.js';
import { ProactiveQueueProcessor } from './queues/proactive-queue.processor.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { PersonalityModule } from '../personality/personality.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'response-queue' },
      { name: 'typing-queue' },
      { name: 'proactive-queue' },
    ),
    forwardRef(() => WhatsappModule),
    AiModule,
    ConversationModule,
    PersonalityModule,
    CalendarModule,
  ],
  providers: [
    SchedulerService,
    ResponseQueueProcessor,
    TypingQueueProcessor,
    ProactiveQueueProcessor,
  ],
  exports: [SchedulerService],
})
export class SchedulerModule {}
