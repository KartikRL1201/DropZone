import { Router } from 'express';
import { getWarehouses, resupplyWarehouse } from '../controllers/warehouse.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', getWarehouses);
router.post('/:id/resupply', requireAuth, resupplyWarehouse);

export default router;
