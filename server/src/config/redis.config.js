import Redis from 'ioredis';
import { env } from './env.config.js';

/**
 * Creates the primary Redis client.
 * Redis serves three purposes in DropZone:
 * 1. Distributed Locks (Redlock) to prevent allocation race conditions.
 * 2. Caching for heavily read, rarely updated data.
 * 3. Pub/Sub backbone for Socket.IO horizontal scaling.
 */
export const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  // Retry strategy for flaky networks
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3, // Prevent hanging forever on a dead Redis
});

// Event listeners for diagnostics
redisClient.on('connect', () => {
  console.log(`✅ Redis Connected: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

// Graceful shutdown helper
export const closeRedis = async () => {
  await redisClient.quit();
};
