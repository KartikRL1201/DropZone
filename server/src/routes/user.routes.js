import { Router } from 'express';
import { getUsers, createUser, deleteUser, updateUser } from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@dropzone/shared-domain';

const router = Router();

// Protect all user management routes, only SUPER_ADMIN can access
router.use(requireAuth, requireRole([UserRole.SUPER_ADMIN]));

router.get('/', getUsers);
router.post('/', createUser);
router.delete('/:id', deleteUser);
router.put('/:id', updateUser);

export default router;
