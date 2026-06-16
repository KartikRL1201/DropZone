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
                batch.forEach(data => {
                    const existing = this.vehicles.get(data.driverId) || { id: data.driverId };
                    existing.crisisId = data.crisisId;
                    existing.location = data.location;
                    existing.heading = data.heading;
                    existing.state = data.state;
                    existing.returning = data.state === 'RETURNING';
                    this.vehicles.set(data.driverId, existing);
                    
                    if (existing.state === 'AT_DESTINATION') {
                        // Hide marker on map to show it's at crisis
                        if (existing.crisisId) {
                            if (mapManager.markers[existing.crisisId]) {
                                mapManager.map.removeLayer(mapManager.markers[existing.crisisId]);
                                delete mapManager.markers[existing.crisisId];
                            }
                            mapManager.hiddenMarkerIds.add(existing.crisisId);
                        }
                    }
                });
                this.renderFleet();
            });

            socketManager.on('driver:returning', (data) => {
                mapManager.renderRoute(data.driverId, data.route, true);
            });

            socketManager.on('mission:completed', (data) => {
                this.vehicles.delete(data.driverId);
                mapManager.removeRouteLayer(data.driverId);
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
            mapManager.removeRouteLayer(driverIdToRemove);
            this.renderFleet();
        }
    }

    clearAllTrucks() {
        this.vehicles.clear();
        mapManager.renderFleet([]);
    }
}

export const fleetManager = new FleetManager();
