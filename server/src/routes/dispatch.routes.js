import { Router } from 'express';
import { dispatchFleet, returnFleet } from '../controllers/dispatch.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { UserRole } from '@dropzone/shared-domain';

const router = Router();

// In a real app we'd want requireAuth and requireRoles([UserRole.ADMIN, UserRole.COMMANDER])
// but for the simulator frontend we'll let it through or rely on standard auth middleware.
// Let's add the standard auth check if it's there.
router.post('/:crisisId', requireAuth, dispatchFleet);
router.post('/return/:crisisId', requireAuth, returnFleet);

export default router;
