import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

@Injectable()
export class CalendarCryptoService {
  private readonly key: Buffer;

  constructor(private config: ConfigService) {
    const hex = this.config.get<string>('GOOGLE_CALENDAR_ENCRYPTION_KEY');
    if (!hex) throw new Error('GOOGLE_CALENDAR_ENCRYPTION_KEY is required');
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(encrypted: string): string {
    const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  generateState(contactId: string): string {
    const timestamp = Date.now().toString(36);
    const payload = `${contactId}.${timestamp}`;
    const signature = createHmac('sha256', this.key)
      .update(payload)
      .digest('hex')
      .slice(0, 16);
    return `${payload}.${signature}`;
  }

  verifyState(state: string): { contactId: string } | null {
    const parts = state.split('.');
    if (parts.length !== 3) return null;

    const [contactId, timestamp, signature] = parts;
    const payload = `${contactId}.${timestamp}`;
    const expected = createHmac('sha256', this.key)
      .update(payload)
      .digest('hex')
      .slice(0, 16);

    if (signature !== expected) return null;

    // Reject states older than 15 minutes
    const ts = parseInt(timestamp, 36);
    if (Date.now() - ts > 15 * 60 * 1000) return null;

    return { contactId };
  }
}
