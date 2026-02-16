import { Injectable, Logger } from '@nestjs/common';
import type {
  CallableTool,
  Tool,
  FunctionCall,
  Part,
} from '@google/genai';
import { CalendarAuthService } from './calendar-auth.service.js';
import { CalendarApiService } from './calendar-api.service.js';
import {
  CALENDAR_FUNCTIONS,
  CONNECT_FUNCTION,
} from './calendar-function-declarations.js';

@Injectable()
export class CalendarToolService {
  private readonly logger = new Logger(CalendarToolService.name);

  constructor(
    private authService: CalendarAuthService,
    private apiService: CalendarApiService,
  ) {}

  async getCallableToolForContact(contactId: string): Promise<CallableTool> {
    const auths = await this.authService.getContactAuths(contactId);
    const hasAuth = auths.length > 0;

    return {
      tool: async (): Promise<Tool> => ({
        functionDeclarations: hasAuth
          ? [...CALENDAR_FUNCTIONS, CONNECT_FUNCTION]
          : [CONNECT_FUNCTION],
      }),
      callTool: async (functionCalls: FunctionCall[]): Promise<Part[]> => {
        const results: Part[] = [];

        for (const fc of functionCalls) {
          try {
            const result = await this.executeFunctionCall(
              contactId,
              auths,
              fc,
            );
            results.push({
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: result,
              },
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              `Calendar tool error: ${fc.name}`,
              error,
            );
            results.push({
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: { error: message },
              },
            });
          }
        }

        return results;
      },
    };
  }

  private async executeFunctionCall(
    contactId: string,
    auths: Array<{ id: string; email: string | null; label: string | null }>,
    fc: FunctionCall,
  ): Promise<Record<string, unknown>> {
    const args = (fc.args || {}) as Record<string, unknown>;

    switch (fc.name) {
      case 'connect_google_calendar': {
        const url = this.authService.generateAuthUrl(contactId);
        return { auth_url: url };
      }

      case 'disconnect_google_calendar': {
        const email = args.account_email as string | undefined;
        const revoked = await this.authService.revokeAccess(
          contactId,
          email,
        );
        return {
          success: revoked,
          message: revoked
            ? 'Agenda desconectada com sucesso'
            : 'Nenhuma agenda encontrada para desconectar',
        };
      }

      case 'list_calendar_events': {
        const authId = this.resolveAuthId(auths, args.account_email as string | undefined);
        const events = await this.apiService.listEvents(authId, {
          timeMin: args.time_min as string | undefined,
          timeMax: args.time_max as string | undefined,
          maxResults: args.max_results as number | undefined,
          q: args.search as string | undefined,
        });
        return { events, count: events.length };
      }

      case 'create_calendar_event': {
        const authId = this.resolveAuthId(auths, args.account_email as string | undefined);
        const startDt = args.start_datetime as string;
        const endDt =
          (args.end_datetime as string) ||
          new Date(
            new Date(startDt).getTime() + 60 * 60 * 1000,
          ).toISOString();

        const event = await this.apiService.createEvent(authId, {
          summary: args.summary as string,
          startDateTime: startDt,
          endDateTime: endDt,
          description: args.description as string | undefined,
          location: args.location as string | undefined,
        });
        return { event, message: 'Evento criado com sucesso' };
      }

      case 'update_calendar_event': {
        const authId = this.resolveAuthId(auths, args.account_email as string | undefined);
        const event = await this.apiService.updateEvent(authId, {
          eventId: args.event_id as string,
          summary: args.summary as string | undefined,
          startDateTime: args.start_datetime as string | undefined,
          endDateTime: args.end_datetime as string | undefined,
          description: args.description as string | undefined,
          location: args.location as string | undefined,
        });
        return { event, message: 'Evento atualizado' };
      }

      case 'delete_calendar_event': {
        const authId = this.resolveAuthId(auths, args.account_email as string | undefined);
        await this.apiService.deleteEvent(
          authId,
          args.event_id as string,
        );
        return { message: 'Evento removido com sucesso' };
      }

      case 'check_availability': {
        const authId = this.resolveAuthId(auths, args.account_email as string | undefined);
        const result = await this.apiService.getFreeBusy(authId, {
          timeMin: args.time_min as string,
          timeMax: args.time_max as string,
        });
        return result;
      }

      case 'list_calendars': {
        const authId = this.resolveAuthId(auths, args.account_email as string | undefined);
        const calendars = await this.apiService.listCalendars(authId);
        return { calendars };
      }

      default:
        return { error: `Unknown function: ${fc.name}` };
    }
  }

  private resolveAuthId(
    auths: Array<{ id: string; email: string | null; label: string | null }>,
    accountEmail?: string,
  ): string {
    if (auths.length === 0) {
      throw new Error(
        'Nenhuma conta do Google Calendar conectada. Use connect_google_calendar primeiro.',
      );
    }

    if (accountEmail) {
      const match = auths.find(
        (a) => a.email?.toLowerCase() === accountEmail.toLowerCase(),
      );
      if (!match) {
        const available = auths
          .map((a) => a.email)
          .filter(Boolean)
          .join(', ');
        throw new Error(
          `Conta ${accountEmail} nao encontrada. Contas disponiveis: ${available}`,
        );
      }
      return match.id;
    }

    // Default to first account if only one
    if (auths.length === 1) return auths[0].id;

    // Multiple accounts — list them so the model can ask the user
    const available = auths
      .map((a) => a.email || a.label || 'sem email')
      .join(', ');
    throw new Error(
      `Multiplas contas conectadas (${available}). Especifique qual conta usar com account_email.`,
    );
  }
}
