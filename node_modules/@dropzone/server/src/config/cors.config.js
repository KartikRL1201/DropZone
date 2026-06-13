import { env } from './env.config.js';

/**
 * Global CORS Configuration.
 * DropZone handles multiple clients (Admin Dashboard, Driver App, Volunteer Portal).
 * We strictly only allow connections from the origins specified in the .env file.
 */
export const corsConfig = {
  origin: env.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  exposedHeaders: ['X-Total-Count'], // Useful for client-side pagination
  credentials: true, // Needed if we ever use secure HttpOnly cookies for sessions
  maxAge: 86400, // Cache preflight requests for 24 hours to reduce latency
};
