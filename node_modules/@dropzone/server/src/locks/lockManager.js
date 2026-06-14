import Redlock from 'redlock';
import { redisClient } from '../config/redis.config.js';
import { env } from '../config/env.config.js';

/**
 * Initialize Redlock with our Redis client.
 * In a real production environment, you would pass an array of multiple independent
 * Redis nodes to achieve high availability. For this setup, we pass our single instance.
 */
const redlock = new Redlock(
  [redisClient],
  {
    // The expected clock drift; for more details see http://redis.io/topics/distlock
    driftFactor: 0.01,

    // The max number of times Redlock will attempt to lock a resource before failing
    retryCount: env.LOCK_RETRY_COUNT,

    // The time in ms between attempts
    retryDelay: env.LOCK_RETRY_DELAY_MS,

    // The max time in ms randomly added to retries
    // to improve performance under high contention
    retryJitter: 200,

    // Ensure locks are automatically released when the process dies
    automaticExtensionThreshold: 500,
  }
);

redlock.on('clientError', (err) => {
  console.error('⚠️ A Redis error has occurred in Redlock:', err);
});

/**
 * Wrapper to acquire a lock and execute a critical function.
 * Ensures the lock is ALWAYS released, even if the function throws an error.
 * 
 * @param {string} resourceKey - The Redis key to lock (from lockKeys.js)
 * @param {Function} criticalSectionFn - Async function to run while holding the lock
 * @param {number} [ttlMs] - Custom TTL in milliseconds. Defaults to env.LOCK_TTL_MS
 * @returns {Promise<any>} - Returns the result of the criticalSectionFn
 */
export const withLock = async (resourceKey, criticalSectionFn, ttlMs = env.LOCK_TTL_MS) => {
  let lock;
  try {
    // Attempt to acquire the lock
    lock = await redlock.acquire([resourceKey], ttlMs);
    
    // Execute the critical section
    const result = await criticalSectionFn();
    return result;

  } catch (error) {
    if (error.name === 'ExecutionError') {
      // This is a Redlock error indicating the lock could not be acquired
      throw new Error(`Resource ${resourceKey} is currently busy. Please try again.`, { cause: error });
    }
    // Re-throw application errors from within the critical section
    throw error;
    
  } finally {
    // ALWAYS release the lock
    if (lock) {
      try {
        await lock.release();
      } catch (releaseError) {
        console.error(`⚠️ Failed to release lock for ${resourceKey}:`, releaseError);
        // We don't throw here because the critical section already finished.
        // The lock will naturally expire via TTL.
      }
    }
  }
};
