import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CalendarAuthService } from './calendar-auth.service.js';
import { WhatsappMessageService } from '../whatsapp/whatsapp-message.service.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller('auth/google')
export class CalendarAuthController {
  private readonly logger = new Logger(CalendarAuthController.name);

  constructor(
    private authService: CalendarAuthService,
    private whatsappMessage: WhatsappMessageService,
    private prisma: PrismaService,
  ) {}

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { contactId, email } = await this.authService.handleCallback(
        code,
        state,
      );

      // Send confirmation via WhatsApp
      const contact = await this.prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (contact) {
        const emailText = email ? ` (${email})` : '';
        await this.whatsappMessage.sendText(
          contact.whatsappJid,
          `conectei sua agenda do google${emailText}! agora posso ver seus compromissos e marcar coisas pra vc`,
        );
      }

      res.status(200).send(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>Kimy</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
          .card { background: white; padding: 2rem; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        </style></head>
        <body><div class="card">
          <h2>Pronto!</h2>
          <p>Sua agenda do Google foi conectada com sucesso.</p>
          <p>Pode fechar esta janela e voltar pro WhatsApp.</p>
        </div></body></html>
      `);

      this.logger.log(`OAuth callback success for contact ${contactId}`);
    } catch (error) {
      this.logger.error('OAuth callback failed', error);
      res.status(400).send(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>Kimy</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
          .card { background: white; padding: 2rem; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        </style></head>
        <body><div class="card">
          <h2>Erro</h2>
          <p>Nao foi possivel conectar a agenda. Tente novamente pelo WhatsApp.</p>
        </div></body></html>
      `);
    }
  }
}
