import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue('response-queue') private responseQueue: Queue,
    @InjectQueue('typing-queue') private typingQueue: Queue,
    @InjectQueue('proactive-queue') private proactiveQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.proactiveQueue.upsertJobScheduler(
      'evaluate-proactive-scheduler',
      { every: 30 * 60 * 1000 },
      { name: 'evaluate-proactive' },
    );
  }

  async scheduleResponse(params: {
    conversationId: string;
    contactId: string;
    jid: string;
    delayMs: number;
    typingDurationMs: number;
  }): Promise<void> {
    const typingDelay = Math.max(
      0,
      params.delayMs - params.typingDurationMs,
    );

    await this.typingQueue.add(
      'show-typing',
      {
        jid: params.jid,
        durationMs: params.typingDurationMs,
      },
      { delay: typingDelay },
    );

    await this.responseQueue.add(
      'send-response',
      {
        conversationId: params.conversationId,
        contactId: params.contactId,
        jid: params.jid,
      },
      { delay: params.delayMs },
    );
  }

  async scheduleReadReceipt(params: {
    jid: string;
    messageIds: string[];
    delayMs: number;
  }): Promise<void> {
    await this.typingQueue.add(
      'mark-as-read',
      {
        jid: params.jid,
        messageIds: params.messageIds,
      },
      { delay: params.delayMs },
    );
  }

  async scheduleProactiveMessage(params: {
    contactId: string;
    jid: string;
    topic: string;
    delayMs: number;
  }): Promise<void> {
    await this.proactiveQueue.add(
      'send-proactive',
      {
        contactId: params.contactId,
        jid: params.jid,
        topic: params.topic,
      },
      { delay: params.delayMs },
    );
  }
}
