import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, type calendar_v3 } from 'googleapis';
import { CalendarAuthService } from './calendar-auth.service.js';

@Injectable()
export class CalendarApiService {
  private readonly logger = new Logger(CalendarApiService.name);

  constructor(
    private config: ConfigService,
    private authService: CalendarAuthService,
  ) {}

  private async getCalendarClient(
    authId: string,
  ): Promise<calendar_v3.Calendar> {
    const tokens = await this.authService.getValidTokens(authId);
    if (!tokens) throw new Error('No valid tokens for this account');

    const oauth2 = new google.auth.OAuth2(
      this.config.get('GOOGLE_CALENDAR_CLIENT_ID'),
      this.config.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
    );

    oauth2.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    return google.calendar({ version: 'v3', auth: oauth2 });
  }

  async listEvents(
    authId: string,
    params: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      q?: string;
    },
  ) {
    const calendar = await this.getCalendarClient(authId);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: params.timeMin || new Date().toISOString(),
      timeMax: params.timeMax,
      maxResults: params.maxResults || 10,
      singleEvents: true,
      orderBy: 'startTime',
      q: params.q,
    });

    return (res.data.items || []).map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
      description: e.description,
      status: e.status,
    }));
  }

  async createEvent(
    authId: string,
    params: {
      summary: string;
      startDateTime: string;
      endDateTime: string;
      description?: string;
      location?: string;
    },
  ) {
    const calendar = await this.getCalendarClient(authId);

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: params.summary,
        start: { dateTime: params.startDateTime, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: params.endDateTime, timeZone: 'America/Sao_Paulo' },
        description: params.description,
        location: params.location,
      },
    });

    return {
      id: res.data.id,
      summary: res.data.summary,
      start: res.data.start?.dateTime,
      end: res.data.end?.dateTime,
      htmlLink: res.data.htmlLink,
    };
  }

  async updateEvent(
    authId: string,
    params: {
      eventId: string;
      summary?: string;
      startDateTime?: string;
      endDateTime?: string;
      description?: string;
      location?: string;
    },
  ) {
    const calendar = await this.getCalendarClient(authId);

    const body: calendar_v3.Schema$Event = {};
    if (params.summary) body.summary = params.summary;
    if (params.description !== undefined) body.description = params.description;
    if (params.location !== undefined) body.location = params.location;
    if (params.startDateTime)
      body.start = { dateTime: params.startDateTime, timeZone: 'America/Sao_Paulo' };
    if (params.endDateTime)
      body.end = { dateTime: params.endDateTime, timeZone: 'America/Sao_Paulo' };

    const res = await calendar.events.patch({
      calendarId: 'primary',
      eventId: params.eventId,
      requestBody: body,
    });

    return {
      id: res.data.id,
      summary: res.data.summary,
      start: res.data.start?.dateTime,
      end: res.data.end?.dateTime,
    };
  }

  async deleteEvent(authId: string, eventId: string) {
    const calendar = await this.getCalendarClient(authId);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    return { deleted: true };
  }

  async getFreeBusy(
    authId: string,
    params: { timeMin: string; timeMax: string },
  ) {
    const calendar = await this.getCalendarClient(authId);

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        items: [{ id: 'primary' }],
      },
    });

    const busy = res.data.calendars?.['primary']?.busy || [];
    return {
      busy: busy.map((b) => ({ start: b.start, end: b.end })),
      free: busy.length === 0,
    };
  }

  async listCalendars(authId: string) {
    const calendar = await this.getCalendarClient(authId);

    const res = await calendar.calendarList.list();
    return (res.data.items || []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary || false,
    }));
  }
}
