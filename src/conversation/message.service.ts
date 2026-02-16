import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  async createMessage(data: {
    conversationId: string;
    contactId?: string;
    direction: 'INBOUND' | 'OUTBOUND';
    content: string;
    whatsappMsgId?: string;
    delayMs?: number;
    isProactive?: boolean;
  }) {
    return this.prisma.message.create({ data });
  }

  async markLastInboundAsSkipped(conversationId: string) {
    const lastInbound = await this.prisma.message.findFirst({
      where: { conversationId, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
    });
    if (lastInbound) {
      await this.prisma.message.update({
        where: { id: lastInbound.id },
        data: { wasSkipped: true },
      });
    }
  }
}
