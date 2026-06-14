import { VolunteerRequest } from '../models/VolunteerRequest.model.js';
import { RequestStatus } from '@dropzone/shared-domain';
import { registerJobProcessor } from './workerManager.js';

/**
 * Job: stale_request_cleanup
 * Purpose: In a disaster, hundreds of requests might be submitted but never
 * fulfilled due to changing conditions or people relocating.
 * This job finds requests that have been PENDING for > 7 days and auto-cancels them
 * to keep the Admin Dashboard clean.
 */
const processStaleRequestCleanup = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const result = await VolunteerRequest.updateMany(
    {
      status: RequestStatus.PENDING,
      submittedAt: { $lt: sevenDaysAgo },
    },
    {
      $set: {
        status: RequestStatus.CANCELLED,
        reviewNotes: 'Auto-cancelled by system: Request stale (> 7 days).',
      },
    }
  );

  if (result.modifiedCount > 0) {
    console.log(`🧹 [Cleanup Job] Auto-cancelled ${result.modifiedCount} stale requests.`);
  }
};

// Register the job with the Worker Manager
registerJobProcessor('stale_request_cleanup', processStaleRequestCleanup);
