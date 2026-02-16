import { Injectable, Logger } from '@nestjs/common';
import { proto } from 'baileys';
import { ConversationService } from '../conversation/conversation.service.js';
import { MessageService } from '../conversation/message.service.js';
import { PersonalityService } from '../personality/personality.service.js';
import { SchedulerService } from '../scheduler/scheduler.service.js';
import { randomBetween } from '../common/utils/random.utils.js';

interface BufferedMessage {
  text: string;
  contactId: string;
  conversationId: string;
  jid: string;
  whatsappMsgId?: string;
}

interface JidBuffer {
  messages: BufferedMessage[];
  timer: ReturnType<typeof setTimeout>;
}

const DEBOUNCE_MS = 8000;

@Injectable()
export class WhatsappEventHandler {
  private readonly logger = new Logger(WhatsappEventHandler.name);
  private readonly messageBuffer = new Map<string, JidBuffer>();

  constructor(
    private conversationService: ConversationService,
    private messageService: MessageService,
    private personalityService: PersonalityService,
    private schedulerService: SchedulerService,
  ) {}

  async handleMessagesUpsert(event: {
    messages: proto.IWebMessageInfo[];
    type: string;
  }): Promise<void> {
    if (event.type !== 'notify') return;

    for (const msg of event.messages) {
      await this.bufferInboundMessage(msg);
    }
  }

  private async bufferInboundMessage(
    msg: proto.IWebMessageInfo,
  ): Promise<void> {
    if (!msg.key) return;
    if (msg.key.fromMe) return;
    if (msg.key.remoteJid === 'status@broadcast') return;

    const jid = msg.key.remoteJid!;
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    if (!text.trim()) return;

    this.logger.debug(
      `Inbound from ${jid}: ${text.substring(0, 80)}`,
    );

    try {
      const contact = await this.conversationService.upsertContact(
        jid,
        msg.pushName || undefined,
      );
      const conversation =
        await this.conversationService.getOrCreateConversation(
          contact.id,
          jid,
        );

      // Persist each message individually
      await this.messageService.createMessage({
        conversationId: conversation.id,
        contactId: contact.id,
        direction: 'INBOUND',
        content: text,
        whatsappMsgId: msg.key.id || undefined,
      });

      // Buffer the message
      const existing = this.messageBuffer.get(jid);

      if (existing) {
        // Reset debounce timer
        clearTimeout(existing.timer);
        existing.messages.push({
          text,
          contactId: contact.id,
          conversationId: conversation.id,
          jid,
          whatsappMsgId: msg.key.id || undefined,
        });
        existing.timer = setTimeout(
          () => this.flushBuffer(jid),
          DEBOUNCE_MS,
        );
        this.logger.debug(
          `Buffered message for ${jid} (${existing.messages.length} total, waiting ${DEBOUNCE_MS}ms)`,
        );
      } else {
        // First message from this JID — start buffer
        const timer = setTimeout(
          () => this.flushBuffer(jid),
          DEBOUNCE_MS,
        );
        this.messageBuffer.set(jid, {
          messages: [
            {
              text,
              contactId: contact.id,
              conversationId: conversation.id,
              jid,
              whatsappMsgId: msg.key.id || undefined,
            },
          ],
          timer,
        });
        this.logger.debug(
          `Started buffer for ${jid} (waiting ${DEBOUNCE_MS}ms)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error buffering message from ${jid}`,
        error,
      );
    }
  }

  private async flushBuffer(jid: string): Promise<void> {
    const buffer = this.messageBuffer.get(jid);
    if (!buffer || buffer.messages.length === 0) return;

    this.messageBuffer.delete(jid);

    const { contactId, conversationId } = buffer.messages[0];
    const combinedText = buffer.messages
      .map((m) => m.text)
      .join('\n');

    // Collect message IDs for delayed read receipt
    const messageIds = buffer.messages
      .map((m) => m.whatsappMsgId)
      .filter((id): id is string => !!id);

    this.logger.debug(
      `Flushing buffer for ${jid}: ${buffer.messages.length} message(s)`,
    );

    try {
      // Schedule delayed read receipt (blue checkmarks)
      if (messageIds.length > 0) {
        const readDelay = Math.round(randomBetween(2000, 15000));
        await this.schedulerService.scheduleReadReceipt({
          jid,
          messageIds,
          delayMs: readDelay,
        });
      }

      const decision =
        await this.personalityService.evaluateResponse({
          contactId,
          conversationId,
          messageText: combinedText,
        });

      if (decision.shouldRespond) {
        await this.schedulerService.scheduleResponse({
          conversationId,
          contactId,
          jid,
          delayMs: decision.delayMs,
          typingDurationMs: decision.typingDurationMs,
        });

        this.logger.debug(
          `Response scheduled for ${jid} in ${decision.delayMs}ms`,
        );
      } else {
        this.logger.debug(`Skipping response to ${jid}`);
        await this.messageService.markLastInboundAsSkipped(
          conversationId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing buffered messages for ${jid}`,
        error,
      );
    }
  }
}
