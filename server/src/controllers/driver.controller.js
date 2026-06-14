import { DriverService } from '../services/driver.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const DriverController = {
  
  async getMyActiveRoute(req, res) {
    try {
      const route = await DriverService.getMyActiveRoute(req.user.id);
      if (!route) {
        return sendSuccess(res, 200, null, 'No active route assigned.');
      }
      return sendSuccess(res, 200, route);
    } catch (error) {
      return sendError(res, 500, error);
    }
  },

  async updateLocation(req, res) {
    try {
      await DriverService.updateLocation(req.user.id, req.body.coordinates);
      // We don't need a heavy JSON payload for this high-frequency endpoint
      return res.status(204).send(); 
    } catch (error) {
      if (error.message.includes('No active route')) {return sendError(res, 404, error);}
      return sendError(res, 500, error);
    }
  },

  async completeWaypoint(req, res) {
    try {
      const route = await DriverService.completeWaypoint(req.user.id, req.params.routeId, req.body.allocationId);
      return sendSuccess(res, 200, route, 'Waypoint completed successfully.');
    } catch (error) {
      if (error.message.includes('not found')) {return sendError(res, 404, error);}
      if (error.message.includes('already completed')) {return sendError(res, 400, error);}
      return sendError(res, 500, error);
    }
  }
};
