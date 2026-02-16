import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { GeminiService } from './gemini.service.js';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly threshold: number;

  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
    private config: ConfigService,
  ) {
    this.threshold = this.config.get('MEMORY_UPDATE_THRESHOLD') || 10;
  }

  async trackOutboundMessage(
    contactId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      const memory = await this.prisma.contactMemory.upsert({
        where: { contactId },
        create: { contactId, messageCountSinceUpdate: 1 },
        update: { messageCountSinceUpdate: { increment: 1 } },
      });

      if (memory.messageCountSinceUpdate >= this.threshold) {
        this.updateMemory(contactId, conversationId).catch((err) =>
          this.logger.error(`Failed to update memory for ${contactId}`, err),
        );
      }
    } catch (error) {
      this.logger.error(`Failed to track outbound message for ${contactId}`, error);
    }
  }

  async updateMemory(
    contactId: string,
    conversationId: string,
  ): Promise<void> {
    const memory = await this.prisma.contactMemory.findUnique({
      where: { contactId },
    });

    const existingFacts = memory?.facts || '';

    const whereClause: Record<string, unknown> = { conversationId };
    if (memory?.lastProcessedMessageId) {
      const lastMsg = await this.prisma.message.findUnique({
        where: { id: memory.lastProcessedMessageId },
        select: { createdAt: true },
      });
      if (lastMsg) {
        whereClause.createdAt = { gt: lastMsg.createdAt };
      }
    }

    const recentMessages = await this.prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 30,
    });

    if (recentMessages.length < 3) {
      this.logger.debug(`Too few new messages (${recentMessages.length}) for ${contactId}, skipping memory update`);
      return;
    }

    const dialogue = recentMessages
      .map((m) => `${m.direction === 'INBOUND' ? 'Pessoa' : 'Kimy'}: ${m.content}`)
      .join('\n');

    const extractionPrompt = `Voce e um sistema de extracao de memoria. Analise a conversa abaixo e extraia fatos importantes sobre a PESSOA (NAO sobre a Kimy).

FATOS EXISTENTES:
${existingFacts || '(nenhum ainda)'}

CONVERSA RECENTE:
${dialogue}

INSTRUCOES:
- Extraia fatos sobre a pessoa: nome, idade, cidade, trabalho, hobbies, gostos, familia, rotina, problemas, planos, etc.
- Mantenha fatos antigos que ainda sao validos.
- Atualize fatos que mudaram (ex: "mora em SP" -> "mudou pra BH").
- Adicione fatos novos relevantes.
- Remova informacoes temporarias (ex: "ta com fome agora").
- Maximo 15 fatos.
- Formato: um fato por linha, sem numeracao, sem bullet points.
- Escreva de forma concisa e direta.
- Se nao houver fatos novos relevantes, retorne os existentes sem mudanca.
- Retorne APENAS os fatos, sem explicacoes.`;

    try {
      const result = await this.gemini.generateResponse({
        systemInstruction: 'Voce extrai e organiza fatos sobre pessoas a partir de conversas.',
        conversationHistory: [],
        userMessage: extractionPrompt,
        temperature: 0.3,
      });

      const lastMessageId = recentMessages[recentMessages.length - 1]!.id;

      await this.prisma.contactMemory.upsert({
        where: { contactId },
        create: {
          contactId,
          facts: result.trim(),
          lastProcessedMessageId: lastMessageId,
          messageCountSinceUpdate: 0,
        },
        update: {
          facts: result.trim(),
          lastProcessedMessageId: lastMessageId,
          messageCountSinceUpdate: 0,
        },
      });

      this.logger.log(`Memory updated for contact ${contactId}`);
    } catch (error) {
      this.logger.error(`Failed to extract memory for ${contactId}`, error);
    }
  }

  async getMemoryForPrompt(contactId: string): Promise<string | null> {
    const memory = await this.prisma.contactMemory.findUnique({
      where: { contactId },
      select: { facts: true },
    });

    if (!memory?.facts) return null;
    return memory.facts;
  }
}
