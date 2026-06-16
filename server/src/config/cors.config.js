import { env } from './env.config.js';

export const corsConfig = {
  // Allow all localhost origins dynamically to prevent dotenv cache issues
  origin: function (origin, callback) {
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400,
};
