import { Router } from 'express';
import { VolunteerController } from '../controllers/volunteer.controller.js';
import { validateRequest } from '../middleware/validator.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';
import { strictVolunteerIntakeLimiter } from '../middleware/rateLimiter.middleware.js';
import { CreateVolunteerRequestSchema } from '@dropzone/shared-utils';
import { UserRole } from '@dropzone/shared-domain';
import { z } from 'zod';

const router = Router();

// Zod schema for the admin review action
const ReviewRequestSchema = z.object({
  status: z.enum(['APPROVED', 'CANCELLED']),
  reviewNotes: z.string().max(1000).optional(),
});

// --- Public Endpoints ---
// This endpoint uses the strict Redis rate limiter because it has no auth
router.post('/submit', 
  strictVolunteerIntakeLimiter, 
  validateRequest(CreateVolunteerRequestSchema), 
  VolunteerController.submitRequest
);

// --- Protected Endpoints (Admin & Coordinators) ---
router.get('/', 
  requireAuth, 
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COORDINATOR]), 
  VolunteerController.getRequests
);

router.patch('/:id/review', 
  requireAuth, 
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COORDINATOR]), 
  validateRequest(ReviewRequestSchema), 
  VolunteerController.reviewRequest
);

export default router;
