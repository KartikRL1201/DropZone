import { Worker, Queue } from 'bullmq';
import { redisClient } from '../config/redis.config.js';

export const QUEUE_NAMES = {
  MAINTENANCE: 'maintenance_queue',
};

// Create a single queue instance
export const maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
  connection: redisClient,
});

/**
 * Registry of job processors.
 * Maps job names to their async execution functions.
 */
const jobProcessors = new Map();

export const registerJobProcessor = (jobName, processorFn) => {
  jobProcessors.set(jobName, processorFn);
};

let worker;

/**
 * Initialize the BullMQ Worker.
 * It continually listens to the Redis queues and executes registered jobs.
 */
export const initWorker = () => {
  worker = new Worker(
    QUEUE_NAMES.MAINTENANCE,
    async (job) => {
      console.log(`[BullMQ] Processing Job: ${job.name} (ID: ${job.id})`);
      
      const processor = jobProcessors.get(job.name);
      if (!processor) {
        throw new Error(`No processor registered for job: ${job.name}`);
      }

      await processor(job.data);
    },
    { connection: redisClient }
  );

  worker.on('completed', (job) => {
    console.log(`[BullMQ] ✅ Job ${job.name} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] ❌ Job ${job.name} failed:`, err);
  });

  return worker;
};

export const closeWorker = async () => {
  if (worker) {
    await worker.close();
  }
};
