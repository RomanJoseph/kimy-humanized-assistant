import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GeminiService } from '../../ai/gemini.service.js';
import { PromptBuilderService } from '../../ai/prompt-builder.service.js';
import { WhatsappMessageService } from '../../whatsapp/whatsapp-message.service.js';
import { MessageService } from '../../conversation/message.service.js';
import { ConversationService } from '../../conversation/conversation.service.js';
import { CalendarToolService } from '../../calendar/calendar-tool.service.js';
import { CalendarAuthService } from '../../calendar/calendar-auth.service.js';
import { MemoryService } from '../../ai/memory.service.js';
import { splitIntoMessages } from '../../common/utils/message-splitter.utils.js';

@Injectable()
@Processor('response-queue')
export class ResponseQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(ResponseQueueProcessor.name);

  constructor(
    private geminiService: GeminiService,
    private promptBuilder: PromptBuilderService,
    private whatsappMessage: WhatsappMessageService,
    private messageService: MessageService,
    private conversationService: ConversationService,
    private calendarTool: CalendarToolService,
    private calendarAuth: CalendarAuthService,
    private memoryService: MemoryService,
  ) {
    super();
  }

  async process(
    job: Job<{
      conversationId: string;
      contactId: string;
      jid: string;
    }>,
  ): Promise<void> {
    const { conversationId, contactId, jid } = job.data;

    try {
      const calTool = await this.calendarTool.getCallableToolForContact(contactId);
      const hasCalendarAuth = await this.calendarAuth.hasCalendarAuth(contactId);

      const systemPrompt = await this.promptBuilder.buildSystemPrompt({
        contactId,
        conversationId,
        isProactive: false,
        hasCalendarTools: hasCalendarAuth,
      });

      const history =
        await this.promptBuilder.buildConversationHistory(conversationId);

      const lastInbound = history.filter((m) => m.role === 'user').pop();
      if (!lastInbound) return;

      let responseText: string;

      responseText =
        await this.geminiService.generateResponseWithTools({
          systemInstruction: systemPrompt,
          conversationHistory: history.slice(0, -1),
          userMessage: lastInbound.content,
          tools: [calTool],
        });

      if (!responseText) {
        this.logger.warn(
          `Empty response from Gemini for conversation ${conversationId}`,
        );
        return;
      }

      // Split response into multiple WhatsApp-style messages
      const parts = splitIntoMessages(responseText.replaceAll('[imagem gerada]', ''));

      if (parts.length > 1) {
        await this.whatsappMessage.sendMultipleTexts(jid, parts);
      } else {
        await this.whatsappMessage.sendText(jid, parts[0] || responseText);
      }

      // Store the full response as one message in DB
      await this.messageService.createMessage({
        conversationId,
        direction: 'OUTBOUND',
        content: parts.join(' '),
        delayMs: job.opts.delay as number,
      });

      await this.conversationService.updateLastActivity(conversationId);

      await this.memoryService.trackOutboundMessage(contactId, conversationId);

      this.logger.debug(
        `Sent ${parts.length} message(s) to ${jid}: ${parts[0]?.substring(0, 50)}`,
      );
    } catch (error) {
      this.logger.error(`Failed to process response for ${jid}`, error);
      throw error;
    }
  }
}
