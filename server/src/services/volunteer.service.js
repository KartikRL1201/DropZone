import { VolunteerRequest } from '../models/VolunteerRequest.model.js';
import { Crisis } from '../models/Crisis.model.js';
import { RequestStatus } from '@dropzone/shared-domain';
import { AuditLog } from '../models/AuditLog.model.js';

export const VolunteerService = {
  
  /**
   * Submit a new volunteer request.
   * This is a public, unauthenticated endpoint.
   */
  async submitRequest(data) {
    // 1. Verify Crisis exists and is ACTIVE
    const crisis = await Crisis.findById(data.crisisId).lean();
    if (!crisis) {throw new Error('Crisis zone not found.');}
    // if (crisis.status === CrisisStatus.RESOLVED) throw new Error('This crisis zone is closed and no longer accepting requests.');

    try {
      // 2. Attempt to save. The unique index on `idempotencyKey` will throw
      // a MongoDB duplicate key error (code 11000) if the user double-clicked.
      const request = new VolunteerRequest(data);
      await request.save();
      return request;
      
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
        // Find and return the already existing request instead of throwing an error
        const existingRequest = await VolunteerRequest.findOne({ idempotencyKey: data.idempotencyKey });
        if (existingRequest) {return existingRequest;}
      }
      throw error;
    }
  },

  /**
   * Admin/Coordinator endpoint: Get paginated requests for the queue
   */
  async getRequests(page = 1, limit = 20, filters = {}) {
    const skip = (page - 1) * limit;
    
    // Sort by status (PENDING first) and then by urgency/date
    const requests = await VolunteerRequest.find(filters)
      .sort({ status: -1, urgency: 1, submittedAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await VolunteerRequest.countDocuments(filters);
    
    return { requests, totalCount };
  },

  /**
   * Admin/Coordinator endpoint: Review a request (Approve/Reject)
   */
  async reviewRequest(requestId, status, reviewNotes, adminUserId) {
    const request = await VolunteerRequest.findById(requestId);
    if (!request) {throw new Error('Request not found.');}

    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot review request. Current status is ${request.status}.`);
    }

    if (![RequestStatus.APPROVED, RequestStatus.CANCELLED].includes(status)) {
      throw new Error('Invalid review status. Must be APPROVED or CANCELLED.');
    }

    const snapshotBefore = request.toObject();

    request.status = status;
    request.reviewedBy = adminUserId;
    if (reviewNotes) {request.reviewNotes = reviewNotes;}

    await request.save();

    await AuditLog.create({
      userId: adminUserId,
      action: `REVIEW_REQUEST_${status}`,
      entityType: 'VolunteerRequest',
      entityId: request._id,
      changes: {
        before: snapshotBefore,
        after: { status, reviewNotes },
      }
    });

    return request;
  }
};
