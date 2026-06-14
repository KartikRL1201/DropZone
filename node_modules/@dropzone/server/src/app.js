import express from 'express';
import cors from 'cors';
import { corsConfig } from './config/cors.config.js';
import { env } from './config/env.config.js';

// Initialize the Express application
const app = express();

// --- Global Middleware Chain ---
// 1. Trust proxy if we are behind a load balancer (e.g., Nginx, Heroku, AWS ELB)
app.set('trust proxy', 1);

// 2. Enable Cross-Origin Resource Sharing (CORS) based on our config
app.use(cors(corsConfig));

// 3. Parse incoming JSON payloads (with a reasonable limit to prevent memory exhaustion attacks)
app.use(express.json({ limit: '1mb' }));

// 4. Parse URL-encoded bodies (for standard form submissions if needed)
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- Routes ---
// Health Check Endpoint (Essential for Docker / Kubernetes liveness probes)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

import routes from './routes/index.js';

// API routes
app.use(env.API_PREFIX, routes);

// --- Error Handling ---
// Catch-all route for unhandled 404s
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled Error:', err);
  
  // Don't leak stack traces in production
  const isProd = env.NODE_ENV === 'production';
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(isProd ? {} : { stack: err.stack }),
  });
});

export default app;
