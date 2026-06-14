import { VolunteerService } from '../services/volunteer.service.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/apiResponse.js';

export const VolunteerController = {
  
  async submitRequest(req, res) {
    try {
      const request = await VolunteerService.submitRequest(req.body);
      // 202 Accepted because the request is placed into a queue for admin review
      return sendSuccess(res, 202, request, 'Your request has been submitted successfully.');
    } catch (error) {
      if (error.message === 'Crisis zone not found.') {return sendError(res, 404, error);}
      return sendError(res, 500, error);
    }
  },

  async getRequests(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      
      const filters = {};
      if (req.query.crisisId) {filters.crisisId = req.query.crisisId;}
      if (req.query.status) {filters.status = req.query.status;}

      const { requests, totalCount } = await VolunteerService.getRequests(page, limit, filters);
      
      return sendPaginated(res, requests, totalCount, page, limit);
    } catch (error) {
      return sendError(res, 500, error);
    }
  },

  async reviewRequest(req, res) {
    try {
      const { status, reviewNotes } = req.body;
      const request = await VolunteerService.reviewRequest(req.params.id, status, reviewNotes, req.user.id);
      return sendSuccess(res, 200, request, `Request marked as ${status}.`);
    } catch (error) {
      if (error.message === 'Request not found.') {return sendError(res, 404, error);}
      if (error.message.includes('Cannot review request')) {return sendError(res, 400, error);}
      if (error.message.includes('Invalid review status')) {return sendError(res, 400, error);}
      if (error.name === 'VersionError') {return sendError(res, 409, 'Conflict: Another admin is reviewing this request.');}
      
      return sendError(res, 500, error);
    }
  }
};
