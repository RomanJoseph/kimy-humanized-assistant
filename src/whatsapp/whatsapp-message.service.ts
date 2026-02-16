import { Injectable } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service.js';
import { randomBetween } from '../common/utils/random.utils.js';

@Injectable()
export class WhatsappMessageService {
  constructor(private whatsapp: WhatsappService) {}

  async sendText(jid: string, text: string): Promise<void> {
    const sock = this.whatsapp.getSocket();
    await sock.sendMessage(jid, { text });
  }

  async sendMultipleTexts(jid: string, parts: string[]): Promise<void> {
    const sock = this.whatsapp.getSocket();

    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        // Pause between messages (1-3s) + typing indicator
        const pauseMs = randomBetween(1000, 3500);
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise((r) => setTimeout(r, pauseMs));
      }
      await sock.sendMessage(jid, { text: parts[i] });
    }
  }

  async sendTypingIndicator(
    jid: string,
    durationMs: number,
  ): Promise<void> {
    const sock = this.whatsapp.getSocket();
    await sock.sendPresenceUpdate('composing', jid);

    if (durationMs > 8000) {
      const intervals = Math.floor(durationMs / 8000);
      for (let i = 1; i < intervals; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        await sock.sendPresenceUpdate('composing', jid);
      }
    }
  }

  async markAsRead(jid: string, messageIds: string[]): Promise<void> {
    const sock = this.whatsapp.getSocket();
    await sock.readMessages(
      messageIds.map((id) => ({ id, remoteJid: jid })),
    );
  }
}
