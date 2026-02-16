import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type ConnectionState,
} from 'baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { WhatsappEventHandler } from './whatsapp-event.handler.js';

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private sock: WASocket | null = null;
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private config: ConfigService,
    private eventHandler: WhatsappEventHandler,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  onModuleDestroy() {
    this.sock?.end(undefined);
  }

  async connect(): Promise<void> {
    const authDir =
      this.config.get('WHATSAPP_AUTH_DIR') || './auth_info_baileys';
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    this.sock = makeWASocket({
      auth: state,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on(
      'connection.update',
      (update: Partial<ConnectionState>) => {
        this.handleConnectionUpdate(update);
      },
    );

    this.sock.ev.on('messages.upsert', (event) => {
      this.eventHandler.handleMessagesUpsert(event);
    });
  }

  private handleConnectionUpdate(
    update: Partial<ConnectionState>,
  ): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.logger.log('QR code generated -- scan with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output
        ?.statusCode;
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        this.logger.warn(
          `Connection closed (code ${statusCode}), reconnecting in 3s...`,
        );
        setTimeout(() => this.connect(), 3000);
      } else {
        this.logger.error(
          'Logged out. Delete auth folder and restart.',
        );
      }
    }

    if (connection === 'open') {
      this.logger.log('WhatsApp connection established');
    }
  }

  getSocket(): WASocket {
    if (!this.sock)
      throw new Error('WhatsApp socket not initialized');
    return this.sock;
  }
}
