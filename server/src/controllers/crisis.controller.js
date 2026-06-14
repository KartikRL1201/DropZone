import { CrisisService } from '../services/crisis.service.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/apiResponse.js';
import { z } from 'zod';
import { CreateCrisisSchema } from '@dropzone/shared-utils';

import { CrisisStatus } from '@dropzone/shared-domain';

export const UpdateCrisisSchema = CreateCrisisSchema.partial().extend({
  status: z.nativeEnum(CrisisStatus).optional(),
});

export const CrisisController = {
  
  async createCrisis(req, res) {
    try {
      const crisis = await CrisisService.createCrisis(req.body, req.user.id);
      return sendSuccess(res, 201, crisis, 'Crisis declared successfully.');
    } catch (error) {
      return sendError(res, 500, error);
    }
  },

  async getCrises(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const status = req.query.status;

      const filters = {};
      if (status) {filters.status = status;}

      const { crises, totalCount } = await CrisisService.getCrises(page, limit, filters);
      
      return sendPaginated(res, crises, totalCount, page, limit);
    } catch (error) {
      return sendError(res, 500, error);
    }
  },

  async getCrisisById(req, res) {
    try {
      const crisis = await CrisisService.getCrisisById(req.params.id);
      return sendSuccess(res, 200, crisis);
    } catch (error) {
      if (error.message === 'Crisis not found') {return sendError(res, 404, error);}
      return sendError(res, 500, error);
    }
  },

  async updateCrisis(req, res) {
    try {
      const crisis = await CrisisService.updateCrisis(req.params.id, req.body, req.user.id);
      return sendSuccess(res, 200, crisis, 'Crisis updated successfully.');
    } catch (error) {
      if (error.name === 'VersionError') {
        return sendError(res, 409, 'Conflict: Crisis was modified by another user. Please refresh and try again.');
      }
      if (error.message === 'Crisis not found') {return sendError(res, 404, error);}
      return sendError(res, 500, error);
    }
  },

  async deleteCrisis(req, res) {
    try {
      await CrisisService.deleteCrisis(req.params.id, req.user.id);
      return sendSuccess(res, 200, null, 'Crisis deleted successfully.');
    } catch (error) {
      if (error.message === 'Crisis not found') {return sendError(res, 404, error);}
      return sendError(res, 500, error);
    }
  },

  async deleteAllCrises(req, res) {
    try {
      await CrisisService.deleteAllCrises(req.user.id);
      return sendSuccess(res, 200, null, 'All crises deleted successfully.');
    } catch (error) {
      return sendError(res, 500, error);
    }
  }
};
