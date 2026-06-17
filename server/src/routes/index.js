import { Router } from 'express';
import authRoutes from './auth.routes.js';
import crisisRoutes from './crisis.routes.js';
import supplyRoutes from './supply.routes.js';
import volunteerRoutes from './volunteer.routes.js';
import driverRoutes from './driver.routes.js';
import dispatchRoutes from './dispatch.routes.js';
import warehouseRoutes from './warehouse.routes.js';
import userRoutes from './user.routes.js';
import { globalRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// Apply global rate limiting to all /api/v1 routes
router.use(globalRateLimiter);

// Mount route modules
router.use('/auth', authRoutes);
router.use('/crises', crisisRoutes);
router.use('/supplies', supplyRoutes);
router.use('/requests', volunteerRoutes);
router.use('/driver', driverRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/users', userRoutes);

export default router;
