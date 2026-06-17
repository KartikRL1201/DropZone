import { Router } from 'express';
import { CrisisController, UpdateCrisisSchema } from '../controllers/crisis.controller.js';
import { validateRequest } from '../middleware/validator.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';
import { CreateCrisisSchema } from '@dropzone/shared-utils';
import { UserRole } from '@dropzone/shared-domain';

const router = Router();

// Publicly readable endpoints (Drivers, Volunteers, and Public can view active crises)
router.get('/', CrisisController.getCrises);
router.get('/:id', CrisisController.getCrisisById);

// Admin-only mutation endpoints
router.post('/', 
  requireAuth, 
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COORDINATOR]), 
  validateRequest(CreateCrisisSchema), 
  CrisisController.createCrisis
);

router.patch('/:id', 
  requireAuth, 
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COORDINATOR]), 
  validateRequest(UpdateCrisisSchema), 
  CrisisController.updateCrisis
);

router.delete('/:id',
  requireAuth,
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COORDINATOR]),
  CrisisController.deleteCrisis
);

router.delete('/',
  requireAuth,
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COORDINATOR]),
  CrisisController.deleteAllCrises
);

export default router;
