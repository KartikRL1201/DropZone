import { Crisis } from '../models/Crisis.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { CrisisStatus } from '@dropzone/shared-domain';
import { getIO } from '../sockets/socketManager.js';

export const CrisisService = {
  
  /**
   * Declare a new Crisis Zone
   */
  async createCrisis(data, adminUserId) {
    const crisis = new Crisis({
      ...data,
      declaredBy: adminUserId,
    });
    
    await crisis.save();

    await AuditLog.create({
      userId: adminUserId,
      action: 'CREATE_CRISIS',
      entityType: 'Crisis',
      entityId: crisis._id,
      changes: {
        after: data,
      }
    });

    // Broadcast to all connected dashboard clients
    try {
      const io = getIO();
      io.emit('crisis:new', crisis.toObject());
    } catch (e) {
      console.error('Socket emit failed:', e.message);
    }

    return crisis;
  },

  /**
   * Get paginated list of active crises
   */
  async getCrises(page = 1, limit = 10, filters = {}) {
    const skip = (page - 1) * limit;
    
    const query = { ...filters };
    if (!query.status) {
      // By default, only show ACTIVE and MONITORING
      query.status = { $in: [CrisisStatus.ACTIVE, CrisisStatus.MONITORING] };
    }

    const crises = await Crisis.find(query)
      .sort({ severity: 1, declaredAt: -1 }) // Custom sorting could be added
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await Crisis.countDocuments(query);
    
    return { crises, totalCount };
  },

  /**
   * Get single crisis details
   */
  async getCrisisById(crisisId) {
    const crisis = await Crisis.findById(crisisId).lean();
    if (!crisis) {throw new Error('Crisis not found');}
    return crisis;
  },

  /**
   * Update crisis status or details
   */
  async updateCrisis(crisisId, updateData, adminUserId) {
    const crisis = await Crisis.findById(crisisId);
    if (!crisis) {throw new Error('Crisis not found');}

    // Create a snapshot before saving for audit log
    const snapshotBefore = crisis.toObject();

    // Apply updates
    Object.keys(updateData).forEach(key => {
      crisis[key] = updateData[key];
    });

    if (updateData.status === CrisisStatus.RESOLVED && !crisis.resolvedAt) {
      crisis.resolvedAt = new Date();
    }

    await crisis.save(); // Optimistic concurrency applies here

    await AuditLog.create({
      userId: adminUserId,
      action: 'UPDATE_CRISIS',
      entityType: 'Crisis',
      entityId: crisis._id,
      changes: {
        before: snapshotBefore,
        after: updateData,
      }
    });

    return crisis;
  },

  async deleteCrisis(crisisId, adminUserId) {
    const crisis = await Crisis.findById(crisisId);
    if (!crisis) {throw new Error('Crisis not found');}
    await crisis.deleteOne();
    await AuditLog.create({
      userId: adminUserId,
      action: 'DELETE_CRISIS',
      entityType: 'Crisis',
      entityId: crisis._id,
      changes: { before: crisis.toObject() }
    });
    // Broadcast delete event
    try {
      const io = getIO();
      io.emit('crisis:delete', { id: crisisId });
    } catch (e) {}
    return true;
  },

  async deleteAllCrises(adminUserId) {
    await Crisis.deleteMany({});
    try {
      const io = getIO();
      io.emit('crisis:deleteAll');
    } catch (e) {}
    return true;
  }
};
