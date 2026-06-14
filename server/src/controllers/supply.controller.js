import { SupplyService } from '../services/supply.service.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/apiResponse.js';

export const SupplyController = {
  
  async addSupply(req, res) {
    try {
      const supply = await SupplyService.addSupply(req.body, req.user.id);
      return sendSuccess(res, 201, supply, 'Supply inventory added successfully.');
    } catch (error) {
      if (error.message === 'Crisis zone not found.') {return sendError(res, 404, error);}
      return sendError(res, 500, error);
    }
  },

  async getSupplies(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      
      const filters = {};
      if (req.query.crisisId) {filters.crisisId = req.query.crisisId;}
      if (req.query.category) {filters.category = req.query.category;}

      const { supplies, totalCount } = await SupplyService.getSupplies(page, limit, filters);
      
      return sendPaginated(res, supplies, totalCount, page, limit);
    } catch (error) {
      return sendError(res, 500, error);
    }
  },

  async updateSupply(req, res) {
    try {
      const supply = await SupplyService.updateSupply(req.params.id, req.body, req.user.id);
      return sendSuccess(res, 200, supply, 'Supply inventory updated.');
    } catch (error) {
      if (error.name === 'VersionError') {
        return sendError(res, 409, 'Conflict: Inventory was modified by another dispatcher.');
      }
      if (error.message.includes('Cannot reduce total quantity')) {return sendError(res, 400, error);}
      if (error.message === 'Supply item not found') {return sendError(res, 404, error);}
      return sendError(res, 500, error);
    }
  }
};
