import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service.js';
import { WhatsappMessageService } from './whatsapp-message.service.js';
import { WhatsappEventHandler } from './whatsapp-event.handler.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { PersonalityModule } from '../personality/personality.module.js';
import { SchedulerModule } from '../scheduler/scheduler.module.js';

@Module({
  imports: [
    ConversationModule,
    PersonalityModule,
    forwardRef(() => SchedulerModule),
  ],
  providers: [
    WhatsappService,
    WhatsappMessageService,
    WhatsappEventHandler,
  ],
  exports: [WhatsappMessageService],
})
export class WhatsappModule {}
