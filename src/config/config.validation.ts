import { z } from 'zod/v4';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z.enum(['debug', 'log', 'warn', 'error']).default('debug'),

  // WhatsApp
  WHATSAPP_AUTH_DIR: z.string().default('./auth_info_baileys'),

  // Gemini
  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  // Personality
  INSTANT_RESPONSE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  PERSONALITY_BASE_DELAY_MS: z.coerce.number().default(3000),
  PERSONALITY_MAX_DELAY_MS: z.coerce.number().default(600000),
  PERSONALITY_SKIP_PROBABILITY: z.coerce.number().default(0.12),
  PERSONALITY_PROACTIVE_MIN_INTERVAL_HOURS: z.coerce.number().default(2),
  PERSONALITY_PROACTIVE_MAX_INTERVAL_HOURS: z.coerce.number().default(8),
  PERSONALITY_SLEEP_START: z.string().default('23:30'),
  PERSONALITY_SLEEP_END: z.string().default('07:30'),

  // Memory
  MEMORY_UPDATE_THRESHOLD: z.coerce.number().default(10),

  // Google Calendar per-contact OAuth
  GOOGLE_CALENDAR_CLIENT_ID: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().optional(),
  GOOGLE_CALENDAR_ENCRYPTION_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    throw new Error(`Config validation error:\n${formatted}`);
  }
  return result.data;
}
