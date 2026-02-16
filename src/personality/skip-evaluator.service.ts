import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class SkipEvaluatorService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async shouldRespond(params: {
    contactId: string;
    conversationId: string;
    messageText: string;
  }): Promise<boolean> {
    const baseProbability =
      this.config.get<number>('PERSONALITY_SKIP_PROBABILITY') ?? 0.12;

    const contact = await this.prisma.contact.findUnique({
      where: { id: params.contactId },
    });
    const contactSkipOverride = contact?.skipProbability || 0;
    const skipProb = Math.max(baseProbability, contactSkipOverride);

    const text = params.messageText.toLowerCase().trim();

    // Always respond to questions
    if (text.includes('?')) return true;
    // Always respond to greetings
    if (/^(oi|ola|eai|e ai|fala|bom dia|boa tarde|boa noite|hey|opa)/i.test(text))
      return true;
    // Always respond to direct mentions
    if (/^(kimy|ky|ei|psiu)/i.test(text)) return true;
    if (text.includes('kimy')) return true;

    // Never respond to very short non-greeting messages
    if (text.length < 2) return false;

    // Don't skip twice in a row
    const recentMessages = await this.prisma.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const lastMessageWasSkipped = recentMessages[0]?.wasSkipped === true;
    if (lastMessageWasSkipped) return true;

    // Always respond after 3+ unanswered inbound messages
    const unansweredCount = this.countConsecutiveInbound(recentMessages);
    if (unansweredCount >= 3) return true;

    // Mood adjustment
    const botState = await this.prisma.botState.findFirst({
      where: { id: 'singleton' },
    });
    let adjustedSkipProb = skipProb;
    if (botState?.mood === 'ocupada') adjustedSkipProb *= 2.0;
    if (botState?.mood === 'animada') adjustedSkipProb *= 0.3;
    if (botState?.mood === 'cansada') adjustedSkipProb *= 1.5;

    adjustedSkipProb = Math.min(adjustedSkipProb, 0.5);

    return Math.random() > adjustedSkipProb;
  }

  private countConsecutiveInbound(
    messages: Array<{ direction: string }>,
  ): number {
    let count = 0;
    for (const msg of messages) {
      if (msg.direction === 'INBOUND') count++;
      else break;
    }
    return count;
  }
}
