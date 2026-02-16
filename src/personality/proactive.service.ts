import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { randomBetween } from '../common/utils/random.utils.js';

@Injectable()
export class ProactiveService {
  private readonly logger = new Logger(ProactiveService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async evaluateProactiveMessages(): Promise<
    Array<{
      contactId: string;
      jid: string;
      topic: string;
      scheduledAt: Date;
    }>
  > {
    const botState = await this.prisma.botState.findFirst({
      where: { id: 'singleton' },
    });
    if (!botState?.proactiveEnabled) return [];
    if (this.isSleepHours(botState)) return [];

    const activeContacts = await this.prisma.contact.findMany({
      where: { isActive: true },
      include: {
        conversations: {
          orderBy: { lastActivity: 'desc' },
          take: 1,
        },
      },
    });

    const results: Array<{
      contactId: string;
      jid: string;
      topic: string;
      scheduledAt: Date;
    }> = [];

    for (const contact of activeContacts) {
      const lastActivity = contact.conversations[0]?.lastActivity;
      if (!lastActivity) continue;

      const hoursSinceLastActivity =
        (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);

      const minInterval =
        this.config.get<number>('PERSONALITY_PROACTIVE_MIN_INTERVAL_HOURS') ?? 2;
      const maxInterval =
        this.config.get<number>('PERSONALITY_PROACTIVE_MAX_INTERVAL_HOURS') ?? 8;

      if (hoursSinceLastActivity < minInterval) continue;

      const probability = Math.min(
        0.3,
        ((hoursSinceLastActivity - minInterval) /
          (maxInterval - minInterval)) *
          0.3,
      );

      if (Math.random() < probability) {
        const topic = this.pickRandomTopic();
        const delayMinutes = randomBetween(5, 60);
        const scheduledAt = new Date(Date.now() + delayMinutes * 60000);

        results.push({
          contactId: contact.id,
          jid: contact.whatsappJid,
          topic,
          scheduledAt,
        });
      }
    }

    return results;
  }

  getProactivePrompt(topic: string): string {
    const prompts: Record<string, string> = {
      dia_a_dia:
        'Mande uma mensagem casual perguntando como ta o dia da pessoa. Seja natural.',
      food: 'Mande algo sobre comida, tipo "ja comeu?" ou comente algo que voce "comeu".',
      plans: 'Pergunte o que a pessoa vai fazer hoje ou no final de semana.',
      random_thought:
        'Compartilhe um pensamento aleatorio sobre algo do dia a dia.',
      music: 'Comente sobre uma musica ou algo que voce ta "ouvindo".',
      complain:
        'Reclame de algo cotidiano de forma leve e engracada.',
      question: 'Faca uma pergunta aleatoria interessante ou engracada.',
      meme_reference:
        'Mande algo engracado ou uma observacao com humor sobre o cotidiano.',
    };
    return prompts[topic] || prompts['dia_a_dia'];
  }

  private isSleepHours(botState: {
    sleepStart: string;
    sleepEnd: string;
  }): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = botState.sleepStart.split(':').map(Number);
    const [endH, endM] = botState.sleepEnd.split(':').map(Number);
    const sleepStart = startH * 60 + startM;
    const sleepEnd = endH * 60 + endM;

    if (sleepStart > sleepEnd) {
      return currentMinutes >= sleepStart || currentMinutes < sleepEnd;
    }
    return currentMinutes >= sleepStart && currentMinutes < sleepEnd;
  }

  private pickRandomTopic(): string {
    const topics = [
      'dia_a_dia',
      'meme_reference',
      'food',
      'plans',
      'random_thought',
      'music',
      'complain',
      'question',
    ];
    return topics[Math.floor(Math.random() * topics.length)];
  }
}
