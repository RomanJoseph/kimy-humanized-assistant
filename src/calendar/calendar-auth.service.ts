import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { PrismaService } from '../database/prisma.service.js';
import { CalendarCryptoService } from './calendar-crypto.service.js';

@Injectable()
export class CalendarAuthService {
  private readonly logger = new Logger(CalendarAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private crypto: CalendarCryptoService,
  ) {
    this.clientId = this.config.get('GOOGLE_CALENDAR_CLIENT_ID') || '';
    this.clientSecret = this.config.get('GOOGLE_CALENDAR_CLIENT_SECRET') || '';
    this.redirectUri = this.config.get('GOOGLE_CALENDAR_REDIRECT_URI') || '';
  }

  private createOAuth2Client() {
    return new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri,
    );
  }

  generateAuthUrl(contactId: string): string {
    const oauth2 = this.createOAuth2Client();
    const state = this.crypto.generateState(contactId);

    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ contactId: string; email: string | null }> {
    const verified = this.crypto.verifyState(state);
    if (!verified) throw new Error('Invalid or expired OAuth state');

    const oauth2 = this.createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing tokens from Google OAuth response');
    }

    // Get user email
    oauth2.setCredentials(tokens);
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const userInfo = await oauth2Api.userinfo.get();
    const email = userInfo.data.email || null;

    // Encrypt tokens
    const encryptedAccess = this.crypto.encrypt(tokens.access_token);
    const encryptedRefresh = this.crypto.encrypt(tokens.refresh_token);
    const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600_000);

    // Upsert (one entry per contactId + email pair)
    await this.prisma.googleCalendarAuth.upsert({
      where: {
        contactId_email: {
          contactId: verified.contactId,
          email: email || '',
        },
      },
      create: {
        contactId: verified.contactId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        email,
      },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
      },
    });

    this.logger.log(
      `Calendar auth saved for contact ${verified.contactId} (${email})`,
    );

    return { contactId: verified.contactId, email };
  }

  async getValidTokens(
    authId: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const auth = await this.prisma.googleCalendarAuth.findUnique({
      where: { id: authId },
    });
    if (!auth) return null;

    const accessToken = this.crypto.decrypt(auth.accessToken);
    const refreshToken = this.crypto.decrypt(auth.refreshToken);

    // Auto-refresh if expired (with 5-minute buffer)
    if (auth.tokenExpiresAt.getTime() < Date.now() + 5 * 60_000) {
      try {
        const oauth2 = this.createOAuth2Client();
        oauth2.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        const { credentials } = await oauth2.refreshAccessToken();
        if (!credentials.access_token) return null;

        const newEncrypted = this.crypto.encrypt(credentials.access_token);
        const newExpires = new Date(
          credentials.expiry_date || Date.now() + 3600_000,
        );

        await this.prisma.googleCalendarAuth.update({
          where: { id: authId },
          data: {
            accessToken: newEncrypted,
            tokenExpiresAt: newExpires,
          },
        });

        return {
          accessToken: credentials.access_token,
          refreshToken,
        };
      } catch (error) {
        this.logger.error(`Token refresh failed for auth ${authId}`, error);
        return null;
      }
    }

    return { accessToken, refreshToken };
  }

  async getContactAuths(contactId: string) {
    return this.prisma.googleCalendarAuth.findMany({
      where: { contactId },
      select: { id: true, email: true, label: true },
    });
  }

  async hasCalendarAuth(contactId: string): Promise<boolean> {
    const count = await this.prisma.googleCalendarAuth.count({
      where: { contactId },
    });
    return count > 0;
  }

  async revokeAccess(contactId: string, email?: string): Promise<boolean> {
    const where = email
      ? { contactId_email: { contactId, email } }
      : undefined;

    if (where) {
      const auth = await this.prisma.googleCalendarAuth.findUnique({ where });
      if (!auth) return false;

      try {
        const token = this.crypto.decrypt(auth.accessToken);
        const oauth2 = this.createOAuth2Client();
        await oauth2.revokeToken(token);
      } catch {
        // Revocation may fail if token already expired — continue anyway
      }

      await this.prisma.googleCalendarAuth.delete({ where });
      return true;
    }

    // Revoke all for this contact
    const auths = await this.prisma.googleCalendarAuth.findMany({
      where: { contactId },
    });

    for (const auth of auths) {
      try {
        const token = this.crypto.decrypt(auth.accessToken);
        const oauth2 = this.createOAuth2Client();
        await oauth2.revokeToken(token);
      } catch {
        // Continue
      }
    }

    await this.prisma.googleCalendarAuth.deleteMany({ where: { contactId } });
    return auths.length > 0;
  }
}
