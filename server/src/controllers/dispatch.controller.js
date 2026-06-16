import { Crisis } from '../models/Crisis.model.js';
import { Warehouse } from '../models/Warehouse.model.js';
import { VolunteerRequest } from '../models/VolunteerRequest.model.js';
import { getIO } from '../sockets/socketManager.js';
import { CrisisStatus } from '@dropzone/shared-domain';

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getRequiredSupplies = (severity) => {
    switch(severity) {
        case 'CRITICAL': return { MEDICAL: getRandomInt(50, 150), WATER: getRandomInt(100, 250), FOOD: getRandomInt(80, 120), BLANKETS: getRandomInt(30, 80) };
        case 'HIGH': return { MEDICAL: getRandomInt(30, 80), WATER: getRandomInt(50, 120), FOOD: getRandomInt(40, 80), BLANKETS: getRandomInt(10, 40) };
        case 'MODERATE': return { MEDICAL: getRandomInt(10, 30), WATER: getRandomInt(20, 60), FOOD: getRandomInt(15, 35), BLANKETS: getRandomInt(5, 15) };
        case 'LOW': return { MEDICAL: getRandomInt(1, 10), WATER: getRandomInt(10, 30), FOOD: getRandomInt(5, 15), BLANKETS: getRandomInt(1, 10) };
        default: return { MEDICAL: getRandomInt(5, 15), WATER: getRandomInt(15, 30), FOOD: getRandomInt(5, 15), BLANKETS: getRandomInt(2, 8) };
    }
};

export const dispatchFleet = async (req, res, next) => {
    try {
        const { crisisId } = req.params;
        const { warehouseId } = req.body || {}; // Optional override

        const crisis = await Crisis.findById(crisisId);
        if (!crisis) {
            return res.status(404).json({ success: false, error: 'Crisis not found' });
        }

        if (crisis.status !== CrisisStatus.ACTIVE) {
            return res.status(400).json({ success: false, error: `Cannot dispatch to a crisis that is ${crisis.status}` });
        }

        // Aggregate actual supplies requested by citizens
        const requests = await VolunteerRequest.find({ crisisId: crisis._id, status: 'PENDING' });
        
        let suppliesRequired = {
            MEDICAL: 0,
            WATER: 0,
            FOOD: 0,
            BLANKETS: 0
        };

        requests.forEach(r => {
            r.items.forEach(item => {
                if (suppliesRequired[item.category] !== undefined) {
                    suppliesRequired[item.category] += item.quantityNeeded;
                }
            });
        });

        let selectedWarehouse = null;

        if (warehouseId) {
            selectedWarehouse = await Warehouse.findById(warehouseId);
            if (!selectedWarehouse) {
                return res.status(404).json({ success: false, error: 'Requested warehouse not found' });
            }
        } else {
            // Find all warehouses sorted by distance
            const warehouses = await Warehouse.find({
                location: {
                    $near: {
                        $geometry: crisis.epicenter || crisis.location
                    }
                }
            });

            if (warehouses.length === 0) {
                return res.status(400).json({ success: false, error: 'No warehouses configured.' });
            }

            // The nearest warehouse
            const nearestWarehouse = warehouses[0];
            
            // Check if nearest warehouse has enough trucks AND supplies
            let nearestIsCapable = true;
            if (nearestWarehouse.trucks.available <= 0) {
                nearestIsCapable = false;
            } else {
                nearestWarehouse.inventory.forEach(item => {
                    if (item.quantity < (suppliesRequired[item.category] || 0)) {
                        nearestIsCapable = false;
                    }
                });
            }

            if (nearestIsCapable) {
                selectedWarehouse = nearestWarehouse;
            } else {
                // Find the next closest capable warehouse
                const alternative = warehouses.find(wh => {
                    if (wh._id.equals(nearestWarehouse._id)) return false;
                    if (wh.trucks.available <= 0) return false;
                    let cap = true;
                    wh.inventory.forEach(item => {
                        if (item.quantity < (suppliesRequired[item.category] || 0)) cap = false;
                    });
                    return cap;
                });

                if (alternative) {
                    return res.status(409).json({
                        success: false,
                        error: 'Nearest warehouse depleted',
                        fallback: {
                            nearest: nearestWarehouse,
                            alternative: alternative,
                            suppliesRequired
                        }
                    });
                } else {
                    return res.status(400).json({ success: false, error: 'ALL warehouses are depleted. Please request airdrops!' });
                }
            }
        }

        // We have a selectedWarehouse, now deduct
        selectedWarehouse.inventory.forEach(item => {
            const reqQty = suppliesRequired[item.category] || 0;
            item.quantity = Math.max(0, item.quantity - reqQty);
        });

        // Mark inventory modified for Mongoose Mixed/Array types just in case
        selectedWarehouse.markModified('inventory');

        // Deduct 1 truck
        selectedWarehouse.trucks.available -= 1;
        selectedWarehouse.markModified('trucks');
        
        console.log('--- DISPATCH DEBUG ---');
        console.log('Warehouse:', selectedWarehouse.name);
        console.log('Trucks available after deduct:', selectedWarehouse.trucks.available);
        console.log('Supplies required:', suppliesRequired);
        console.log('Inventory after deduct:', selectedWarehouse.inventory.map(i => `${i.category}: ${i.quantity}`));
        console.log('--- END DISPATCH ---');
        
        await selectedWarehouse.save();

        // Update crisis
        crisis.status = CrisisStatus.MONITORING;
        crisis.dispatchStatus = 'PENDING_DRIVER';
        crisis.assignedWarehouseId = selectedWarehouse._id;
        await crisis.save();

        const populatedCrisis = await Crisis.findById(crisis._id).populate('assignedWarehouseId');

        // Broadcast updates
        const io = getIO();
        io.emit('crisis:updated', populatedCrisis);
        io.emit('warehouse:updated', selectedWarehouse);

        // Notify Drivers at this specific warehouse
        io.to(`warehouse:${selectedWarehouse._id}`).emit('driver:dispatch_requested', {
            crisis: populatedCrisis,
            manifest: suppliesRequired,
            warehouse: selectedWarehouse
        });

        return res.status(200).json({
            success: true,
            data: populatedCrisis,
            warehouse: selectedWarehouse
        });
    } catch (error) {
        next(error);
    }
};

export const acceptDispatch = async (req, res, next) => {
    try {
        const { crisisId } = req.params;
        const { driverId } = req.body;

        const crisis = await Crisis.findById(crisisId).populate('assignedWarehouseId');
        if (!crisis) {
            return res.status(404).json({ success: false, error: 'Crisis not found' });
        }

        if (crisis.dispatchStatus !== 'PENDING_DRIVER') {
            return res.status(400).json({ success: false, error: 'Dispatch is not pending a driver' });
        }

        crisis.dispatchStatus = 'IN_TRANSIT'; // We keep this as in transit for the dashboard
        crisis.assignedDriverId = driverId;
        await crisis.save();

        const io = getIO();
        io.emit('crisis:updated', crisis);
        io.emit('dispatch:accepted', {
            crisisId: crisis._id,
            driverId,
            warehouse: crisis.assignedWarehouseId
        });
        
        // Pass to Fleet Engine to fetch route and set to PENDING_START
        const { fleetEngine } = await import('../sockets/FleetEngine.js');
        const originCoords = [crisis.assignedWarehouseId.location.coordinates[1], crisis.assignedWarehouseId.location.coordinates[0]];
        const destCoords = [crisis.epicenter.coordinates[1], crisis.epicenter.coordinates[0]];
        
        // Ensure the global loop is running
        fleetEngine.start();
        
        const mission = await fleetEngine.acceptMission(
            driverId, 
            crisis._id, 
            crisis.name, 
            originCoords, 
            destCoords, 
            null // manifest not stored in db yet, let's omit for now
        );

        if (!mission) {
             return res.status(500).json({ success: false, error: 'Failed to create route for mission' });
        }

        if (io) {
            io.emit('fleet:new_mission', mission);
        }

        return res.status(200).json({ success: true, data: crisis, mission });
    } catch (error) {
        next(error);
    }
};

export const returnFleet = async (req, res, next) => {
    try {
        const { crisisId } = req.params;
        const { driverId } = req.body; // Driver app must send its driverId now

        const crisis = await Crisis.findById(crisisId);
        if (!crisis) {
            return res.status(404).json({ success: false, error: 'Valid crisis not found' });
        }

        const { fleetEngine } = await import('../sockets/FleetEngine.js');
        
        if (driverId) {
            // Trigger return journey via engine
            const success = await fleetEngine.startReturn(driverId);
            if (!success) {
                return res.status(500).json({ success: false, error: 'Failed to start return journey' });
            }
            return res.status(200).json({ success: true, message: 'Return journey started' });
        } else {
            let warehouse = null;
            if (crisis.assignedWarehouseId) {
                warehouse = await Warehouse.findById(crisis.assignedWarehouseId);
                if (warehouse) {
                    warehouse.trucks.available += 1;
                    // Cap at total
                    if (warehouse.trucks.available > warehouse.trucks.total) {
                        warehouse.trucks.available = warehouse.trucks.total;
                    }
                    await warehouse.save();
                    
                    const io = getIO();
                    io.emit('warehouse:updated', warehouse);
                }
            }

            const cancelledDriverId = fleetEngine.cancelMissionByCrisisId(crisisId);
            if (cancelledDriverId) {
                try {
                    const io = getIO();
                    io.to(`driver:${cancelledDriverId}`).emit('server:cancel_mission');
                } catch(e) {}
            }

            await VolunteerRequest.deleteMany({ crisisId });
            await Crisis.findByIdAndDelete(crisisId);
            
            const io = getIO();
            io.emit('crisis:delete', { id: crisisId });

            return res.status(200).json({
                success: true,
                message: 'Truck returned to warehouse and crisis resolved',
                warehouse: warehouse
            });
        }
    } catch (error) {
        next(error);
    }
};
