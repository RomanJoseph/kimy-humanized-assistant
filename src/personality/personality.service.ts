import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { DelayCalculatorService } from './delay-calculator.service.js';
import { SkipEvaluatorService } from './skip-evaluator.service.js';
import { randomBetween } from '../common/utils/random.utils.js';

@Injectable()
export class PersonalityService implements OnModuleInit {
  private readonly logger = new Logger(PersonalityService.name);
  private moodTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private config: ConfigService,
    private delayCalculator: DelayCalculatorService,
    private skipEvaluator: SkipEvaluatorService,
    private prisma: PrismaService,
  ) { }

  async onModuleInit() {
    await this.prisma.botState.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
    this.startMoodCycle();
  }

  async evaluateResponse(params: {
    contactId: string;
    conversationId: string;
    messageText: string;
  }): Promise<{
    shouldRespond: boolean;
    delayMs: number;
    typingDurationMs: number;
  }> {
    if (this.config.get<boolean>('INSTANT_RESPONSE')) {
      return { shouldRespond: true, delayMs: 0, typingDurationMs: 0 };
    }

    const shouldRespond = await this.skipEvaluator.shouldRespond({
      contactId: params.contactId,
      conversationId: params.conversationId,
      messageText: params.messageText,
    });

    if (!shouldRespond) {
      return { shouldRespond: false, delayMs: 0, typingDurationMs: 0 };
    }

    const { delayMs, typingDurationMs } =
      await this.delayCalculator.calculateDelay({
        messageText: params.messageText,
        contactId: params.contactId,
        conversationId: params.conversationId,
      });

    return { shouldRespond: true, delayMs, typingDurationMs };
  }

  private startMoodCycle() {
    const cycleFn = async () => {
      const hour = new Date().getHours();

      let newMood: string;
      if (hour >= 23 || hour < 7) {
        newMood = 'cansada';
      } else if (hour >= 9 && hour < 12) {
        newMood = Math.random() < 0.6 ? 'animada' : 'neutra';
      } else if (hour >= 14 && hour < 16) {
        newMood = Math.random() < 0.4 ? 'ocupada' : 'neutra';
      } else {
        const moods = [
          'animada',
          'neutra',
          'neutra',
          'neutra',
          'cansada',
          'ocupada',
        ];
        newMood = moods[Math.floor(Math.random() * moods.length)];
      }

      await this.prisma.botState.update({
        where: { id: 'singleton' },
        data: { mood: newMood, lastMoodChange: new Date() },
      });

      this.logger.log(`Mood changed to: ${newMood}`);
    };

    const scheduleNext = () => {
      const intervalMs = randomBetween(2 * 3600000, 6 * 3600000);
      this.moodTimer = setTimeout(async () => {
        await cycleFn();
        scheduleNext();
      }, intervalMs);
    };

    cycleFn();
    scheduleNext();
  }
}
