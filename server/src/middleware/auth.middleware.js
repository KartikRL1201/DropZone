import { verifyAccessToken } from '../utils/jwt.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Middleware to verify JWT Access Token.
 * Extracs the token from the Authorization header (Bearer format)
 * and attaches the decoded user payload to the request object.
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Unauthorized: Missing or invalid token format.');
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return sendError(res, 401, 'Unauthorized: Token not provided.');
  }

  // Temporary development bypass for Admin Dashboard
  if (token === 'mock-hq-token-123') {
    req.user = { id: '111111111111111111111111', role: 'SUPER_ADMIN' };
    return next();
  }

  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return sendError(res, 401, 'Unauthorized: Token is expired or invalid.');
  }

  // Attach the decoded user info to the request for downstream controllers
  req.user = decoded;
  next();
};
