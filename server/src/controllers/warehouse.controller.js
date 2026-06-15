import { Warehouse } from '../models/Warehouse.model.js';

export const getWarehouses = async (req, res, next) => {
    try {
        const warehouses = await Warehouse.find().lean();
        return res.status(200).json({ success: true, data: warehouses });
    } catch (error) {
        next(error);
    }
};

import { getIO } from '../sockets/socketManager.js';

export const resupplyWarehouse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const warehouse = await Warehouse.findById(id);
        
        if (!warehouse) {
            return res.status(404).json({ success: false, error: 'Warehouse not found' });
        }

        // Simulate 60-second Airdrop
        setTimeout(async () => {
            try {
                const wh = await Warehouse.findById(id);
                if (wh) {
                    wh.inventory.forEach(item => {
                        // Hardcode arbitrary full capacities for simulation
                        if (item.category === 'MEDICAL') item.quantity = 2000;
                        if (item.category === 'WATER') item.quantity = 5000;
                        if (item.category === 'FOOD') item.quantity = 3000;
                        if (item.category === 'BLANKETS') item.quantity = 1000;
                        if (item.category === 'EQUIPMENT') item.quantity = 500;
                    });
                    wh.markModified('inventory');
                    await wh.save();
                    
                    const io = getIO();
                    io.emit('warehouse:updated', wh);
                }
            } catch (err) {
                console.error('Error during airdrop resupply', err);
            }
        }, 60000);

        return res.status(202).json({
            success: true,
            message: 'Airdrop requested. ETA: 60 seconds.',
            estimatedArrivalSeconds: 60
        });

    } catch (error) {
        next(error);
    }
};
