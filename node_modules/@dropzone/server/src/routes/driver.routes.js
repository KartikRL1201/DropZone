import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller.js';
import { validateRequest } from '../middleware/validator.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';
import { UpdateLocationSchema, CompleteWaypointSchema } from '@dropzone/shared-utils';
import { UserRole } from '@dropzone/shared-domain';

const router = Router();

// All routes here require the DRIVER role
router.use(requireAuth, requireRoles([UserRole.DRIVER]));

// Get my current assigned route
router.get('/my-route', DriverController.getMyActiveRoute);

// High-frequency GPS updates (called every 5-10 seconds by the mobile app)
router.patch('/location', 
  validateRequest(UpdateLocationSchema), 
  DriverController.updateLocation
);

// Mark a delivery dropoff as complete
router.post('/routes/:routeId/complete-waypoint', 
  validateRequest(CompleteWaypointSchema), 
  DriverController.completeWaypoint
);

export default router;
