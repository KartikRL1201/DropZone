import { DriverRoute } from '../models/DriverRoute.model.js';
import { Allocation } from '../models/Allocation.model.js';
import { RouteStatus, AllocationStatus } from '@dropzone/shared-domain';
import { AuditLog } from '../models/AuditLog.model.js';
import mongoose from 'mongoose';

export const DriverService = {
  
  /**
   * Driver mobile app pulls their active route
   */
  async getMyActiveRoute(driverId) {
    const route = await DriverRoute.findOne({
      driverId,
      status: { $in: [RouteStatus.QUEUED, RouteStatus.IN_PROGRESS] }
    })
    .populate('allocationIds') // Populate the full allocation details so the driver sees what they are carrying
    .lean();
    
    return route;
  },

  /**
   * Driver updates their live GPS location.
   * This is called frequently by the mobile app's background geolocation service.
   */
  async updateLocation(driverId, coordinates) {
    const route = await DriverRoute.findOne({
      driverId,
      status: { $in: [RouteStatus.QUEUED, RouteStatus.IN_PROGRESS] }
    });

    if (!route) {throw new Error('No active route found to update location.');}

    // We don't use optimistic concurrency here because location updates happen too fast
    // and we don't care if a previous location is overwritten by a newer one.
    await DriverRoute.updateOne(
      { _id: route._id },
      { 
        $set: { 
          currentPosition: { type: 'Point', coordinates } 
        } 
      }
    );

    // Broadcast the live driver position to anyone viewing the Admin map for this crisis
    const io = (await import('../sockets/socketManager.js')).getIO();
    io.to(`crisis:${route.crisisId}`).emit('driver:position', { driverId, coordinates });

    return true;
  },

  /**
   * Driver marks a specific waypoint (delivery) as completed.
   */
  async completeWaypoint(driverId, routeId, allocationId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const route = await DriverRoute.findOne({ _id: routeId, driverId }).session(session);
      if (!route) {throw new Error('Route not found or unassigned.');}

      const waypoint = route.waypoints.find(w => w.allocationId.toString() === allocationId);
      if (!waypoint) {throw new Error('Waypoint not found on this route.');}
      if (waypoint.completed) {throw new Error('Waypoint is already completed.');}

      // Mark waypoint as complete
      waypoint.completed = true;
      waypoint.completedAt = new Date();
      await route.save({ session });

      // Update the underlying Allocation status
      const allocation = await Allocation.findById(allocationId).session(session);
      if (allocation) {
        allocation.status = AllocationStatus.DELIVERED;
        allocation.deliveredAt = new Date();
        await allocation.save({ session });
        
        await AuditLog.create({
          userId: driverId,
          action: 'COMPLETE_DELIVERY',
          entityType: 'Allocation',
          entityId: allocation._id,
          changes: { after: { status: AllocationStatus.DELIVERED } }
        });
      }

      // Check if this was the last waypoint on the route
      const allCompleted = route.waypoints.every(w => w.completed);
      if (allCompleted) {
        route.status = RouteStatus.COMPLETED;
        route.completedAt = new Date();
        await route.save({ session });
      }

      await session.commitTransaction();
      return route;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
};
