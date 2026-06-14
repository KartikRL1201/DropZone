import { SupplyItem } from '../models/SupplyItem.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { Crisis } from '../models/Crisis.model.js';

export const SupplyService = {
  
  /**
   * Add a new supply pallet/item to a crisis warehouse
   */
  async addSupply(data, adminUserId) {
    // 1. Verify the crisis exists
    const crisisExists = await Crisis.exists({ _id: data.crisisId });
    if (!crisisExists) {throw new Error('Crisis zone not found.');}

    const supply = new SupplyItem(data);
    await supply.save();

    await AuditLog.create({
      userId: adminUserId,
      action: 'ADD_SUPPLY',
      entityType: 'SupplyItem',
      entityId: supply._id,
      changes: {
        after: data,
      }
    });

    return supply;
  },

  /**
   * Get paginated list of supplies (optionally filtered by Crisis or Category)
   */
  async getSupplies(page = 1, limit = 20, filters = {}) {
    const skip = (page - 1) * limit;
    
    // We use .populate to also pull the Crisis name if needed by the dashboard
    const supplies = await SupplyItem.find(filters)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await SupplyItem.countDocuments(filters);
    
    return { supplies, totalCount };
  },

  /**
   * Update an existing supply (e.g. physical inventory audit corrects the totalQuantity)
   */
  async updateSupply(supplyId, updateData, adminUserId) {
    const supply = await SupplyItem.findById(supplyId);
    if (!supply) {throw new Error('Supply item not found');}

    const snapshotBefore = supply.toObject();

    // Specific logic: You can't set totalQuantity below what has already been allocated
    if (updateData.totalQuantity !== undefined) {
      if (updateData.totalQuantity < supply.allocatedQuantity) {
        throw new Error(`Cannot reduce total quantity below the currently allocated amount (${supply.allocatedQuantity}).`);
      }
      supply.totalQuantity = updateData.totalQuantity;
    }

    if (updateData.lowStockThreshold !== undefined) {supply.lowStockThreshold = updateData.lowStockThreshold;}
    if (updateData.warehouseLocation !== undefined) {supply.warehouseLocation = updateData.warehouseLocation;}

    await supply.save();

    await AuditLog.create({
      userId: adminUserId,
      action: 'UPDATE_SUPPLY',
      entityType: 'SupplyItem',
      entityId: supply._id,
      changes: {
        before: snapshotBefore,
        after: updateData,
      }
    });

    return supply;
  }
};
