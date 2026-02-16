import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WhatsappMessageService } from '../../whatsapp/whatsapp-message.service.js';

@Injectable()
@Processor('typing-queue')
export class TypingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(TypingQueueProcessor.name);

  constructor(private whatsappMessage: WhatsappMessageService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'show-typing') {
      await this.whatsappMessage.sendTypingIndicator(
        job.data.jid,
        job.data.durationMs,
      );
    } else if (job.name === 'mark-as-read') {
      await this.whatsappMessage.markAsRead(
        job.data.jid,
        job.data.messageIds,
      );
      this.logger.debug(
        `Marked ${job.data.messageIds.length} message(s) as read for ${job.data.jid}`,
      );
    }
  }
}
