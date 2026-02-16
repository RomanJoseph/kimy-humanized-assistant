import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { CalendarCryptoService } from './calendar-crypto.service.js';
import { CalendarAuthService } from './calendar-auth.service.js';
import { CalendarAuthController } from './calendar-auth.controller.js';
import { CalendarApiService } from './calendar-api.service.js';
import { CalendarToolService } from './calendar-tool.service.js';

@Module({
  imports: [DatabaseModule, forwardRef(() => WhatsappModule)],
  controllers: [CalendarAuthController],
  providers: [
    CalendarCryptoService,
    CalendarAuthService,
    CalendarApiService,
    CalendarToolService,
  ],
  exports: [CalendarAuthService, CalendarToolService],
})
export class CalendarModule {}
