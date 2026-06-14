import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file (relative to process.cwd() which is 'server')
dotenv.config();

/**
 * Zod schema to rigidly validate environment variables at startup.
 * If any of these are missing or typed incorrectly, the server crashes immediately
 * rather than failing silently later during a disaster response.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  API_PREFIX: z.string().default('/api/v1'),
  
  MONGODB_URI: z.string().startsWith('mongodb'),
  MONGODB_DB_NAME: z.string().min(1),
  
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  
  CORS_ORIGINS: z.string().transform((str) => str.split(',').map(s => s.trim())),
  
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  LOCK_TTL_MS: z.string().transform(Number).default('10000'),
  LOCK_RETRY_COUNT: z.string().transform(Number).default('3'),
  LOCK_RETRY_DELAY_MS: z.string().transform(Number).default('200'),
});

// Parse and export the validated environment config
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid Environment Variables:');
  console.error(parseResult.error.format());
  process.exit(1); // Crash early, crash loud
}

export const env = parseResult.data;
