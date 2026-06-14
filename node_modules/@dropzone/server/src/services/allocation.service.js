import mongoose from 'mongoose';
import { SupplyItem } from '../models/SupplyItem.model.js';
import { VolunteerRequest } from '../models/VolunteerRequest.model.js';
import { Allocation } from '../models/Allocation.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { withLock } from '../locks/lockManager.js';
import { LockKeys } from '../locks/lockKeys.js';
import { RequestStatus, AllocationStatus } from '@dropzone/shared-domain';

import { calculatePriorityScore } from '../engine/priority.engine.js';
import { Crisis } from '../models/Crisis.model.js';

/**
 * Allocation Engine Service
 * 
 * Handles the highly contentious operation of matching limited supplies to volunteer requests.
 * Uses a three-layer defense against race conditions:
 * 1. Redis Distributed Lock (Redlock)
 * 2. MongoDB ACID Transaction
 * 3. Mongoose Optimistic Concurrency Control
 */

/**
 * Atomically fulfills a specific item within a volunteer request.
 * 
 * @param {Object} params
 * @param {string} params.supplyItemId - The ID of the warehouse stock being drawn from.
 * @param {string} params.requestId - The ID of the volunteer request being fulfilled.
 * @param {string} params.itemCategory - The category to fulfill (e.g. "WATER").
 * @param {number} params.quantityToAllocate - How much to pull from the warehouse.
 * @param {string} params.adminUserId - The user ID authorizing this action.
 * @returns {Promise<Object>} The created allocation record.
 */
export const allocateSupplyToRequest = async ({
  supplyItemId,
  requestId,
  itemCategory,
  quantityToAllocate,
  adminUserId
}) => {
  // LAYER 1: Acquire a distributed lock on the specific supply item.
  // If another admin is allocating from this same supply pallet, we wait.
  return await withLock(LockKeys.supplyItem(supplyItemId), async () => {
    
    // LAYER 2: Start a MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch the supply item inside the transaction
      const supply = await SupplyItem.findById(supplyItemId).session(session);
      if (!supply) {throw new Error('Supply item not found.');}

      // Double-check category matches
      if (supply.category !== itemCategory) {
        throw new Error(`Category mismatch. Expected ${itemCategory}, got ${supply.category}`);
      }

      // Check inventory levels
      if (supply.availableQuantity < quantityToAllocate) {
        throw new Error(`Insufficient inventory. Requested ${quantityToAllocate}, but only ${supply.availableQuantity} available.`);
      }

      // 2. Fetch the Volunteer Request and Crisis inside the transaction
      const request = await VolunteerRequest.findById(requestId).session(session);
      if (!request) {throw new Error('Volunteer request not found.');}

      const crisis = await Crisis.findById(request.crisisId).session(session);
      if (!crisis) {throw new Error('Crisis zone not found.');}

      // Find the specific item in the request array
      const requestItem = request.items.find(item => item.category === itemCategory);
      if (!requestItem) {
        throw new Error(`Volunteer request does not ask for ${itemCategory}.`);
      }

      // Prevent over-fulfilling the request
      const remainingNeeded = requestItem.quantityNeeded - requestItem.quantityFulfilled;
      if (quantityToAllocate > remainingNeeded) {
        throw new Error(`Cannot allocate more than needed. Only ${remainingNeeded} more units required.`);
      }

      // --- MUTATIONS START HERE ---

      // 3. Decrement Supply
      supply.allocatedQuantity += quantityToAllocate;
      await supply.save({ session }); // Layer 3: Optimistic Concurrency triggers here

      // 4. Update Request
      requestItem.quantityFulfilled += quantityToAllocate;
      
      // If all items in the request are fully fulfilled, mark the whole request as ALLOCATED
      const isFullyFulfilled = request.items.every(
        (item) => item.quantityFulfilled >= item.quantityNeeded
      );
      if (isFullyFulfilled) {
        request.status = RequestStatus.ALLOCATED;
      } else if (request.status === RequestStatus.PENDING || request.status === RequestStatus.APPROVED) {
        // If it's partially fulfilled, we keep it in an intermediate state, but we ensure it's at least APPROVED
        request.status = RequestStatus.APPROVED;
      }
      await request.save({ session });

      // Calculate fair-share priority score
      const calculatedScore = calculatePriorityScore({
        crisisSeverity: crisis.severity,
        requestUrgency: request.urgency,
        submittedAt: request.submittedAt,
        peopleCount: request.peopleCount,
      });

      // 5. Create the Allocation Record
      const allocation = new Allocation({
        crisisId: request.crisisId,
        supplyItemId: supply._id,
        volunteerRequestId: request._id,
        category: itemCategory,
        quantity: quantityToAllocate,
        status: AllocationStatus.PENDING,
        priorityScore: calculatedScore,
      });
      await allocation.save({ session });

      // 6. Generate Immutable Audit Log
      const auditLog = new AuditLog({
        userId: adminUserId,
        action: 'ALLOCATE_SUPPLY',
        entityType: 'Allocation',
        entityId: allocation._id,
        changes: {
          after: {
            supplyItemId: supply._id,
            volunteerRequestId: request._id,
            quantityAllocated: quantityToAllocate,
          }
        }
      });
      await auditLog.save({ session });

      // --- COMMIT TRANSACTION ---
      await session.commitTransaction();
      
      // Return the new allocation document
      return allocation;

    } catch (error) {
      // If anything fails (insufficient stock, version error, etc), completely roll back the database state
      await session.abortTransaction();
      throw error;
    } finally {
      // Always end the session
      session.endSession();
    }
  });
};
