import { mapManager } from './mapManager.js';

class FleetManager {
    constructor() {
        this.vehicles = new Map();
        this.speedMultiplier = 1.0;
        
        import('./socketManager.js').then(({ socketManager }) => {
            
            // Listen for full mission dumps on load/reconnect
            socketManager.on('fleet:active_missions', (missions) => {
                console.log("[FLEET] Received active missions:", missions);
                missions.forEach(mission => {
                    if (mission.routePath && mission.routePath.length > 0) {
                        mapManager.renderRoute(mission.driverId, mission.routePath, mission.state === 'RETURNING');
                    }
                    this.vehicles.set(mission.driverId, {
                        id: mission.driverId,
                        crisisId: mission.crisisId,
                        location: mission.currentLocation,
                        heading: mission.heading,
                        state: mission.state,
                        returning: mission.state === 'RETURNING'
                    });
                });
                this.renderFleet();
            });

            // Dynamically draw the route for a newly accepted mission
            socketManager.on('fleet:new_mission', (mission) => {
                if (mission.routePath && mission.routePath.length > 0) {
                    mapManager.renderRoute(mission.driverId, mission.routePath, mission.state === 'RETURNING');
                }
            });

            // Listen for 500ms telemetry ticks
            socketManager.on('fleet:telemetry', (batch) => {
                const activeIds = new Set(batch.map(d => d.driverId));
                for (const driverId of this.vehicles.keys()) {
                    if (!activeIds.has(driverId)) {
                        this.vehicles.delete(driverId);
                    }
                }

                batch.forEach(data => {
                    const vehicle = this.vehicles.get(data.driverId) || {};
                    vehicle.id = data.driverId;
                    vehicle.crisisId = data.crisisId;
                    vehicle.location = data.location;
                    vehicle.heading = data.heading;
                    vehicle.state = data.state;
                    vehicle.returning = data.state === 'RETURNING';
                    this.vehicles.set(data.driverId, vehicle);
                    
                    if (vehicle.state === 'AT_DESTINATION') {
                        if (vehicle.crisisId) {
                            if (mapManager.markers[vehicle.crisisId]) {
                                mapManager.map.removeLayer(mapManager.markers[vehicle.crisisId]);
                                delete mapManager.markers[vehicle.crisisId];
                            }
                            mapManager.hiddenMarkerIds.add(vehicle.crisisId);
                        }
                    }
                    
                    // Render movement on map
                    mapManager.updateTruckMarker(data.driverId, data.location, data.heading, data.state);
                });
                this.renderFleet();
            });

            socketManager.on('driver:returning', (data) => {
                mapManager.renderRoute(data.driverId, data.route, true);
            });

            socketManager.on('mission:completed', (data) => {
                this.vehicles.delete(data.driverId);
                this.renderFleet();
            });
            
            // When a dispatch is freshly accepted, it might take a moment for fleet:telemetry to start
            socketManager.on('dispatch:accepted', (data) => {
                console.log("[FLEET] Dispatch accepted, waiting for telemetry...");
            });
            
            socketManager.on('crisis:deleted', (crisisId) => {
                this.removeTruckForCrisis(crisisId);
            });
        });
    }

    renderFleet() {
        const vArray = Array.from(this.vehicles.values());
        mapManager.renderFleet(vArray);
    }

    setSpeed(multiplier) {
        this.speedMultiplier = multiplier;
        import('./socketManager.js').then(({ socketManager }) => {
            if (socketManager.socket && socketManager.socket.connected) {
                socketManager.socket.emit('admin:speed_update', multiplier);
            }
        });
    }

    syncWithQueue(crises) {
        // No longer dispatch trucks here! The server sends active missions.
        // We just ignore this call.
    }

    removeTruckForCrisis(crisisId) {
        let driverIdToRemove = null;
        for (const [driverId, v] of this.vehicles.entries()) {
            if (v.crisisId === crisisId) {
                driverIdToRemove = driverId;
                break;
            }
        }
        if (driverIdToRemove) {
            this.vehicles.delete(driverIdToRemove);
            this.renderFleet();
        }
    }

    clearAllTrucks() {
        this.vehicles.clear();
        mapManager.renderFleet([]);
    }
}

export const fleetManager = new FleetManager();
