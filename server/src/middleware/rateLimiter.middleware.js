import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis.config.js';
import { env } from '../config/env.config.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Standard Rate Limiter
 * Used across most API endpoints to prevent abuse.
 * Backed by Redis, meaning rate limits are enforced globally across
 * all Node.js instances in a cluster/load-balanced environment.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // e.g. 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS, // Limit each IP to X requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Use Redis as the global store
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),

  // Custom response handler to match our API standards
  handler: (req, res, next, options) => {
    sendError(res, options.statusCode, 'Too many requests, please try again later.');
  },
});

/**
 * Strict Rate Limiter for Public Volunteer Intake
 * Because the volunteer request endpoint is unauthenticated, it is 
 * highly susceptible to spam. We limit this severely (e.g., 5 requests per hour per IP).
 */
export const strictVolunteerIntakeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl:volunteer:', // Separate Redis namespace
  }),

  handler: (req, res, next, options) => {
    sendError(res, 429, 'You have reached the maximum number of requests for this hour. Please wait before submitting another request.');
  },
});
