import { sendError } from '../utils/apiResponse.js';

/**
 * Middleware for Role-Based Access Control (RBAC).
 * Must be used AFTER requireAuth middleware.
 * 
 * @param {string[]} allowedRoles - Array of UserRole constants allowed to access this route.
 */
export const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Unauthorized: Authentication required before checking roles.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, 'Forbidden: You do not have permission to perform this action.');
    }

    next();
  };
};
