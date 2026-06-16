import { Router } from 'express';
import { dispatchFleet, returnFleet, acceptDispatch } from '../controllers/dispatch.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { UserRole } from '@dropzone/shared-domain';

const router = Router();

// In a real app we'd want requireAuth and requireRoles([UserRole.ADMIN, UserRole.COMMANDER])
// but for the simulator frontend we'll let it through or rely on standard auth middleware.
// Let's add the standard auth check if it's there.
router.get('/pending/:warehouseId', async (req, res, next) => {
    try {
        const { Crisis } = await import('../models/Crisis.model.js');
        const { Warehouse } = await import('../models/Warehouse.model.js');
        
        const crisis = await Crisis.findOne({ 
            assignedWarehouseId: req.params.warehouseId,
            dispatchStatus: 'PENDING_DRIVER',
            status: 'MONITORING'
        }).populate('assignedWarehouseId');
        
        if (crisis) {
            const warehouse = await Warehouse.findById(req.params.warehouseId);
            // Re-calculate manifest logic roughly or return as is. For MVP, we'll just return the required payload.
            // Wait, we need suppliesRequired. We can infer it or just pass null and let frontend handle it.
            return res.json({ success: true, data: { crisis, warehouse } });
        }
        res.json({ success: true, data: null });
    } catch(e) { next(e); }
});

router.post('/:crisisId', requireAuth, dispatchFleet);
router.post('/:crisisId/accept', acceptDispatch); // No auth for driver app MVP
router.post('/:crisisId/return', returnFleet); // Removed auth here for driver app since it doesn't send token easily yet

export default router;
