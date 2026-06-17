import { Router } from 'express';
import { AuthController, RegisterSchema, LoginSchema } from '../controllers/auth.controller.js';
import { validateRequest } from '../middleware/validator.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';
import { UserRole } from '@dropzone/shared-domain';

import { authLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// Public routes
router.post('/login', authLimiter, validateRequest(LoginSchema), AuthController.login);
router.post('/refresh', AuthController.refresh);

// Protected routes
router.post('/logout', requireAuth, AuthController.logout);

// Admin-only routes
router.post('/register', 
  requireAuth, 
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN]), 
  validateRequest(RegisterSchema), 
  AuthController.register
);

export default router;
