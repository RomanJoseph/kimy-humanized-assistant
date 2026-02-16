import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  async upsertContact(jid: string, pushName?: string) {
    return this.prisma.contact.upsert({
      where: { whatsappJid: jid },
      update: pushName ? { pushName } : {},
      create: { whatsappJid: jid, pushName },
    });
  }

  async getOrCreateConversation(contactId: string, jid: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { contactId },
      orderBy: { lastActivity: 'desc' },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: { contactId },
    });
  }

  async updateLastActivity(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastActivity: new Date() },
    });
  }
}
