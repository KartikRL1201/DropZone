import { Router } from 'express';
import { SupplyController } from '../controllers/supply.controller.js';
import { validateRequest } from '../middleware/validator.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';
import { CreateSupplySchema, UpdateSupplySchema } from '@dropzone/shared-utils';
import { UserRole } from '@dropzone/shared-domain';

const router = Router();

// Everyone who is authenticated (including drivers & coordinators) can view supplies
router.get('/', requireAuth, SupplyController.getSupplies);

// Only Admins can add or modify the warehouse stock
router.post('/', 
  requireAuth, 
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN]), 
  validateRequest(CreateSupplySchema), 
  SupplyController.addSupply
);

router.patch('/:id', 
  requireAuth, 
  requireRoles([UserRole.SUPER_ADMIN, UserRole.ADMIN]), 
  validateRequest(UpdateSupplySchema), 
  SupplyController.updateSupply
);

export default router;
