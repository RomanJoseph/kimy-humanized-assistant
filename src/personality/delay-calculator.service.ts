import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { randomBetween } from '../common/utils/random.utils.js';

@Injectable()
export class DelayCalculatorService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async calculateDelay(params: {
    messageText: string;
    contactId: string;
    conversationId: string;
  }): Promise<{ delayMs: number; typingDurationMs: number }> {
    const botState = await this.prisma.botState.findFirst({
      where: { id: 'singleton' },
    });
    const mood = botState?.mood || 'neutra';

    // Base delay by message length
    const msgLength = params.messageText.length;
    let baseDelayMs: number;

    if (msgLength < 5) {
      baseDelayMs = randomBetween(2000, 8000);
    } else if (msgLength < 30) {
      baseDelayMs = randomBetween(5000, 25000);
    } else if (msgLength < 100) {
      baseDelayMs = randomBetween(15000, 60000);
    } else {
      baseDelayMs = randomBetween(30000, 120000);
    }

    // Mood multiplier
    const moodMultipliers: Record<string, number> = {
      animada: 0.6,
      neutra: 1.0,
      cansada: 1.8,
      ocupada: 2.5,
    };
    const moodMult = moodMultipliers[mood] || 1.0;

    // Time-of-day multiplier
    const hour = new Date().getHours();
    let timeMult = 1.0;
    if (hour >= 23 || hour < 7) timeMult = 3.0;
    else if (hour >= 7 && hour < 9) timeMult = 1.5;
    else if (hour >= 12 && hour < 14) timeMult = 1.3;
    else if (hour >= 18 && hour < 20) timeMult = 0.8;

    // 10% chance of spike (walked away from phone)
    const spikeMult = Math.random() < 0.1 ? randomBetween(3, 8) : 1.0;

    // Final delay
    let finalDelay = baseDelayMs * moodMult * timeMult * spikeMult;
    const maxDelay = this.config.get<number>('PERSONALITY_MAX_DELAY_MS') ?? 600000;
    finalDelay = Math.max(2000, Math.min(finalDelay, maxDelay));

    // Typing duration (simulate typing speed)
    const responseEstimatedLength = Math.min(msgLength * 1.5, 200);
    const charsPerMs = randomBetween(40, 80) / 60000;
    let typingDurationMs = responseEstimatedLength / charsPerMs;
    typingDurationMs = Math.max(1500, Math.min(typingDurationMs, 12000));

    return {
      delayMs: Math.round(finalDelay),
      typingDurationMs: Math.round(typingDurationMs),
    };
  }
}
