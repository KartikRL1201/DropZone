import { mapManager } from './mapManager.js';

class FleetManager {
    constructor() {
        this.vehicles = [];
        this.simulationLoop = null;
        this.speedMultiplier = 1.0;
    }

    setSpeed(multiplier) {
        this.speedMultiplier = multiplier;
    }

    syncWithQueue(crises) {
        if (!crises) return;
        crises.forEach(crisis => {
            // If the database says it's dispatched, but we have no truck for it in memory, spawn one!
            if (crisis.status === 'MONITORING' && crisis.assignedWarehouseId) {
                const isDispatched = this.vehicles.some(v => v.crisisId === crisis._id);
                if (!isDispatched) {
                    this.dispatchTruck(crisis);
                }
            }
        });
    }

    removeTruckForCrisis(crisisId) {
        // Remove the vehicle object from the array
        this.vehicles = this.vehicles.filter(v => {
            if (v.crisisId === crisisId) {
                // If the truck had an active map route, clear it
                if (mapManager.routeLayers && mapManager.routeLayers[v.id]) {
                    mapManager.map.removeLayer(mapManager.routeLayers[v.id]);
                    delete mapManager.routeLayers[v.id];
                }
                return false;
            }
            return true;
        });
        mapManager.renderFleet(this.vehicles);
    }

    clearAllTrucks() {
        this.vehicles.forEach(v => {
            if (mapManager.routeLayers && mapManager.routeLayers[v.id]) {
                mapManager.map.removeLayer(mapManager.routeLayers[v.id]);
                delete mapManager.routeLayers[v.id];
            }
        });
        this.vehicles = [];
        mapManager.renderFleet(this.vehicles);
    }

    async fetchOSRMRoute(startLat, startLng, endLat, endLng) {
        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.routes && data.routes[0]) {
                return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
            }
        } catch (error) {
            console.error('OSRM Routing Error:', error);
        }
        return null;
    }

    async dispatchTruck(crisis) {
        // Support both 'epicenter' (real DB schema) and 'location' (legacy/direct)
        const geo = crisis.epicenter || crisis.location;
        if (!geo || !geo.coordinates) return;
        const targetLng = geo.coordinates[0];
        const targetLat = geo.coordinates[1];

        // Find assigned warehouse from backend
        let hubLat, hubLng;
        
        if (crisis.assignedWarehouseId && crisis.assignedWarehouseId.location) {
            const coords = crisis.assignedWarehouseId.location.coordinates;
            hubLng = coords[0];
            hubLat = coords[1];
        } else {
            console.error("No assigned warehouse provided by backend!");
            return;
        }

        // Create new truck
        const truckId = `DPZ-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const vehicle = { 
            id: truckId, 
            crisisId: crisis._id,
            assignedWarehouseId: crisis.assignedWarehouseId._id, // Keep track of where it came from
            warehouseLocation: [hubLat, hubLng],
            returning: false,
            route: [], 
            routeIndex: 0, 
            progress: 0, 
            speed: 0.003, 
            location: [hubLat, hubLng], 
            heading: 0, 
            target: [targetLat, targetLng] 
        };

        this.vehicles.push(vehicle);

        // Fetch Route
        const route = await this.fetchOSRMRoute(hubLat, hubLng, targetLat, targetLng);
        if (route && route.length > 0) {
            vehicle.route = route;
            
            // Fast-forward simulation if time has passed since dispatch (e.g. on page refresh)
            if (crisis.updatedAt) {
                const elapsedMs = Date.now() - new Date(crisis.updatedAt).getTime();
                if (elapsedMs > 0) {
                    // Simulate 33ms ticks using the current speed multiplier
                    let remainingTicks = Math.floor(elapsedMs / 33);
                    if (remainingTicks > 9000) remainingTicks = 9000; // Cap at ~5 mins to prevent freezing
                    
                    while (remainingTicks > 0 && !vehicle.done) {
                        if (vehicle.routeIndex >= vehicle.route.length - 1) {
                            vehicle.done = true;
                            break;
                        }

                        const startPoint = vehicle.route[vehicle.routeIndex];
                        const endPoint = vehicle.route[vehicle.routeIndex + 1];
                        if (!startPoint || !endPoint) break;

                        const dist = Math.sqrt(Math.pow(endPoint[0] - startPoint[0], 2) + Math.pow(endPoint[1] - startPoint[1], 2));
                        const segmentSpeed = dist > 0 ? (vehicle.speed / dist) * 0.0001 : 1; 

                        vehicle.progress += segmentSpeed * this.speedMultiplier;

                        if (vehicle.progress >= 1) {
                            vehicle.progress = 0;
                            vehicle.routeIndex++;
                        } else {
                            vehicle.location[0] = startPoint[0] + (endPoint[0] - startPoint[0]) * vehicle.progress;
                            vehicle.location[1] = startPoint[1] + (endPoint[1] - startPoint[1]) * vehicle.progress;
                            
                            const dy = endPoint[0] - startPoint[0];
                            const dx = endPoint[1] - startPoint[1];
                            vehicle.heading = (Math.atan2(dx, dy) * 180 / Math.PI);
                        }
                        remainingTicks--;
                    }
                }
            }

            if (!vehicle.done) {
                mapManager.renderRoute(vehicle.id, route);
                this.startSimulation();
            } else {
                // If it finished during fast-forward, we need to mark it deleted
                if (window.deleteCrisis) window.deleteCrisis(vehicle.crisisId);
                vehicle.crisisId = null;
                // Remove from array since it's done
                this.vehicles = this.vehicles.filter(v => v.id !== vehicle.id);
            }
        }
    }

    startSimulation() {
        if (this.simulationLoop) return;
        
        // Run animation loop (30fps)
        this.simulationLoop = setInterval(() => {
            this._updatePositions();
            mapManager.renderFleet(this.vehicles);
        }, 33);

        // Edge case: If admin closes tab while trucks are returning, they would be lost forever.
        // We tell the backend to return them immediately.
        window.addEventListener('beforeunload', () => {
            this.vehicles.forEach(v => {
                if (v.returning && v.crisisId) {
                    // We use sendBeacon so it reliably fires on page close
                    navigator.sendBeacon(`http://localhost:5000/api/v1/dispatch/return/${v.crisisId}`);
                }
            });
        });
    }

    _updatePositions() {
        this.vehicles.forEach((v) => {
            if (!v.route || v.route.length === 0) return;

            // If reached the end of the route
            if (v.routeIndex >= v.route.length - 1) {
                if (!v.returning) {
                    // Reached the crisis zone! 
                    // We DO NOT delete the crisis here anymore, so it survives page reloads while returning!
                    v.returning = true;
                    
                    // Hide the marker on the map!
                    if (v.crisisId) {
                        if (mapManager.markers[v.crisisId]) {
                            mapManager.map.removeLayer(mapManager.markers[v.crisisId]);
                            delete mapManager.markers[v.crisisId];
                        }
                        mapManager.hiddenMarkerIds.add(v.crisisId);
                    }
                    
                    // Fetch return route
                    const startLat = v.location[0];
                    const startLng = v.location[1];
                    const endLat = v.warehouseLocation[0];
                    const endLng = v.warehouseLocation[1];

                    // Fire and forget, the route will update when ready
                    this.fetchOSRMRoute(startLat, startLng, endLat, endLng).then(route => {
                        if (route && route.length > 0) {
                            v.route = route;
                            v.routeIndex = 0;
                            v.progress = 0;
                            mapManager.renderRoute(v.id, route);
                        } else {
                            v.done = true; // Fallback if routing fails
                        }
                    });
                    
                    // Prevent moving until route is loaded
                    v.route = []; 
                    return;
                } else {
                    // Reached the warehouse!
                    if (v.crisisId) {
                        // Tell backend to return the truck and delete the crisis
                        fetch(`http://localhost:5000/api/v1/dispatch/return/${v.crisisId}`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${window.MOCK_HQ_TOKEN || ''}` }
                        }).catch(console.error);
                        
                        v.crisisId = null; // Prevent double delete
                    }
                    
                    // Remove from array since it's done
                    this.vehicles = this.vehicles.filter(vehicle => vehicle.id !== v.id);
                }
            }

            const startPoint = v.route[v.routeIndex];
            const endPoint = v.route[v.routeIndex + 1];
            if (!startPoint || !endPoint) return;

            // Move progress forward based on segment distance
            // We use a fixed speed modifier. Shorter segments complete faster.
            const dist = Math.sqrt(Math.pow(endPoint[0] - startPoint[0], 2) + Math.pow(endPoint[1] - startPoint[1], 2));
            // Prevent division by zero on zero-length segments
            const segmentSpeed = dist > 0 ? (v.speed / dist) * 0.0001 : 1; 

            v.progress += segmentSpeed * this.speedMultiplier;

            if (v.progress >= 1) {
                // Moved to next segment
                v.progress = 0;
                v.routeIndex++;
            } else {
                // Interpolate exact position on the line
                v.location[0] = startPoint[0] + (endPoint[0] - startPoint[0]) * v.progress;
                v.location[1] = startPoint[1] + (endPoint[1] - startPoint[1]) * v.progress;
                
                // Calculate heading (Leaflet handles rotation via CSS degrees)
                const dy = endPoint[0] - startPoint[0];
                const dx = endPoint[1] - startPoint[1];
                const angleRad = Math.atan2(dx, dy); 
                v.heading = (angleRad * 180 / Math.PI);
            }
        });
        
        // Remove completed vehicles from fleet
        this.vehicles = this.vehicles.filter(v => !v.done);
    }
}

export const fleetManager = new FleetManager();
