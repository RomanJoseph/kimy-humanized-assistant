import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { validate } from './config/config.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { WhatsappModule } from './whatsapp/whatsapp.module.js';
import { AiModule } from './ai/ai.module.js';
import { PersonalityModule } from './personality/personality.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { ConversationModule } from './conversation/conversation.module.js';
import { CalendarModule } from './calendar/calendar.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    ConversationModule,
    AiModule,
    PersonalityModule,
    SchedulerModule,
    WhatsappModule,
    CalendarModule,
  ],
})
export class AppModule {}
