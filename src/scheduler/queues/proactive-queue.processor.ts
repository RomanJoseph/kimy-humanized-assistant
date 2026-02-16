import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProactiveService } from '../../personality/proactive.service.js';
import { SchedulerService } from '../scheduler.service.js';
import { GeminiService } from '../../ai/gemini.service.js';
import { PromptBuilderService } from '../../ai/prompt-builder.service.js';
import { WhatsappMessageService } from '../../whatsapp/whatsapp-message.service.js';
import { ConversationService } from '../../conversation/conversation.service.js';
import { MessageService } from '../../conversation/message.service.js';
import { randomBetween } from '../../common/utils/random.utils.js';
import { CalendarToolService } from '../../calendar/calendar-tool.service.js';
import { CalendarAuthService } from '../../calendar/calendar-auth.service.js';
import { MemoryService } from '../../ai/memory.service.js';
import { splitIntoMessages } from '../../common/utils/message-splitter.utils.js';

@Injectable()
@Processor('proactive-queue')
export class ProactiveQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(ProactiveQueueProcessor.name);

  constructor(
    private proactiveService: ProactiveService,
    private schedulerService: SchedulerService,
    private geminiService: GeminiService,
    private promptBuilder: PromptBuilderService,
    private whatsappMessage: WhatsappMessageService,
    private conversationService: ConversationService,
    private messageService: MessageService,
    private calendarTool: CalendarToolService,
    private calendarAuth: CalendarAuthService,
    private memoryService: MemoryService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'evaluate-proactive') {
      await this.handleEvaluateProactive();
    } else if (job.name === 'send-proactive') {
      await this.handleSendProactive(job.data);
    }
  }

  private async handleEvaluateProactive(): Promise<void> {
    const messages =
      await this.proactiveService.evaluateProactiveMessages();

    for (const msg of messages) {
      const delayMs = msg.scheduledAt.getTime() - Date.now();
      await this.schedulerService.scheduleProactiveMessage({
        contactId: msg.contactId,
        jid: msg.jid,
        topic: msg.topic,
        delayMs: Math.max(0, delayMs),
      });
    }

    if (messages.length > 0) {
      this.logger.debug(
        `Scheduled ${messages.length} proactive messages`,
      );
    }
  }

  private async handleSendProactive(data: {
    contactId: string;
    jid: string;
    topic: string;
  }): Promise<void> {
    try {
      const conversation =
        await this.conversationService.getOrCreateConversation(
          data.contactId,
          data.jid,
        );

      const calTool = await this.calendarTool.getCallableToolForContact(data.contactId);
      const hasCalendarAuth = await this.calendarAuth.hasCalendarAuth(data.contactId);

      const systemPrompt = await this.promptBuilder.buildSystemPrompt({
        contactId: data.contactId,
        conversationId: conversation.id,
        isProactive: true,
        hasCalendarTools: hasCalendarAuth,
      });

      const history =
        await this.promptBuilder.buildConversationHistory(
          conversation.id,
          10,
        );

      const proactivePrompt =
        this.proactiveService.getProactivePrompt(data.topic);

      let responseText: string;

      responseText =
        await this.geminiService.generateResponseWithTools({
          systemInstruction: systemPrompt,
          conversationHistory: history,
          userMessage: proactivePrompt,
          tools: [calTool],
        });

      if (!responseText) return;

      const parts = splitIntoMessages(responseText);

      const typingDuration = randomBetween(1500, 4000);
      await this.whatsappMessage.sendTypingIndicator(
        data.jid,
        typingDuration,
      );
      await new Promise((r) => setTimeout(r, typingDuration));

      if (parts.length > 1) {
        await this.whatsappMessage.sendMultipleTexts(data.jid, parts);
      } else {
        await this.whatsappMessage.sendText(data.jid, parts[0] || responseText);
      }

      await this.messageService.createMessage({
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        content: parts.join(' '),
        isProactive: true,
      });

      await this.conversationService.updateLastActivity(conversation.id);

      await this.memoryService.trackOutboundMessage(data.contactId, conversation.id);

      this.logger.log(
        `Proactive message sent to ${data.jid}: ${responseText.substring(0, 50)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send proactive message to ${data.jid}`,
        error,
      );
      throw error;
    }
  }
}
