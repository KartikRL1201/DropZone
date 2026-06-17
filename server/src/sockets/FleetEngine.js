import https from 'https';
import http from 'http';
import { getIO } from './socketManager.js';

class FleetEngine {
    constructor() {
        this.activeMissions = new Map();
        this.globalSpeedMultiplier = 1;
        this.tickInterval = null;
        this.lastTickTime = Date.now();
    }

    start() {
        if (this.tickInterval) return;
        this.lastTickTime = Date.now();
        // Run tick loop at 100ms for smooth 10fps updates, or 250ms for 4fps. 
        // 100ms is good for smooth leaflet panning.
        this.tickInterval = setInterval(() => this.tick(), 100);
        console.log('[FLEET ENGINE] Started');
    }

    setSpeed(multiplier) {
        this.globalSpeedMultiplier = multiplier;
        console.log(`[FLEET ENGINE] Speed multiplier set to ${multiplier}x`);
    }

    async acceptMission(driverId, driverName, crisisId, crisisName, originCoords, destCoords, manifest) {
        console.log(`[FLEET ENGINE] Accepting mission for ${driverName} (${driverId}) to ${crisisId}`);
        
        // Fetch route from OSRM
        const route = await this.fetchOSRMRoute(originCoords[0], originCoords[1], destCoords[0], destCoords[1]);
        if (!route || route.length < 2) {
            console.error(`[FLEET ENGINE] Failed to fetch route for ${driverId}`);
            return null;
        }

        let cumulativeDistances = [0];
        let totalRouteLength = 0;
        for (let i = 0; i < route.length - 1; i++) {
            const p1 = route[i];
            const p2 = route[i + 1];
            const dist = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
            totalRouteLength += dist;
            cumulativeDistances.push(totalRouteLength);
        }

        const mission = {
            driverId,
            driverName,
            crisisId,
            crisisName,
            manifest,
            originCoords,
            destCoords,
            routePath: route,
            cumulativeDistances,
            totalRouteLength,
            totalDistanceTraveled: 0,
            isReturning: false,
            state: 'PENDING_START', // 'PENDING_START', 'DRIVING', 'AT_DESTINATION', 'RETURNING'
            currentLocation: route[0],
            heading: 0
        };

        this.activeMissions.set(driverId, mission);
        return mission;
    }

    startEngine(driverId) {
        const mission = this.activeMissions.get(driverId);
        if (mission && mission.state === 'PENDING_START') {
            mission.state = 'DRIVING';
            console.log(`[FLEET ENGINE] Engine started for ${driverId}`);
            return true;
        }
        return false;
    }

    async startReturn(driverId) {
        const mission = this.activeMissions.get(driverId);
        if (!mission) {
            console.error(`[FLEET ENGINE] Cannot return: mission not found for ${driverId}`);
            return false;
        }

        console.log(`[FLEET ENGINE] Starting return trip for ${driverId}`);
        const route = await this.fetchOSRMRoute(mission.destCoords[0], mission.destCoords[1], mission.originCoords[0], mission.originCoords[1]);
        if (!route || route.length < 2) {
            console.error(`[FLEET ENGINE] Failed to fetch return route for ${driverId}`);
            return false;
        }

        let cumulativeDistances = [0];
        let totalRouteLength = 0;
        for (let i = 0; i < route.length - 1; i++) {
            const p1 = route[i];
            const p2 = route[i + 1];
            const dist = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
            totalRouteLength += dist;
            cumulativeDistances.push(totalRouteLength);
        }

        mission.routePath = route;
        mission.cumulativeDistances = cumulativeDistances;
        mission.totalRouteLength = totalRouteLength;
        mission.totalDistanceTraveled = 0;
        mission.isReturning = true;
        mission.state = 'RETURNING';
        mission.currentLocation = route[0];

        // Broadcast to hq that this driver is returning so it can draw the green line
        const io = getIO();
        if (io) {
            io.to('hq').emit('driver:returning', {
                driverId: mission.driverId,
                crisisId: mission.crisisId,
                route: mission.routePath
            });
            io.to(`driver:${mission.driverId}`).emit('driver:returning', {
                driverId: mission.driverId,
                crisisId: mission.crisisId,
                route: mission.routePath
            });
        }

        return true;
    }

    cancelMissionByCrisisId(crisisId) {
        let foundDriverId = null;
        for (const [driverId, mission] of this.activeMissions.entries()) {
            if (mission.crisisId.toString() === crisisId.toString()) {
                foundDriverId = driverId;
                break;
            }
        }
        if (foundDriverId) {
            this.activeMissions.delete(foundDriverId);
        }
        return foundDriverId;
    }

    cancelAllMissions() {
        this.activeMissions.clear();
    }

    getMission(driverId) {
        return this.activeMissions.get(driverId);
    }

    tick() {
        const now = Date.now();
        const dt = (now - this.lastTickTime) / 1000;
        this.lastTickTime = now;

        const speedDegPerSec = 0.000075 * this.globalSpeedMultiplier;
        const telemetryBatch = [];

        for (const [driverId, mission] of this.activeMissions.entries()) {
            if (mission.state === 'PENDING_START') {
                telemetryBatch.push({
                    driverId,
                    location: mission.currentLocation,
                    heading: mission.heading,
                    state: mission.state,
                    crisisId: mission.crisisId
                });
                continue;
            }

            if (mission.state === 'AT_DESTINATION') {
                // Keep emitting AT_DESTINATION so late clients see it
                telemetryBatch.push({
                    driverId,
                    location: mission.currentLocation,
                    heading: mission.heading,
                    state: mission.state,
                    crisisId: mission.crisisId
                });
                continue;
            }

            mission.totalDistanceTraveled += speedDegPerSec * dt;

            // Check completion
            if (mission.totalDistanceTraveled >= mission.totalRouteLength) {
                // Arrived
                const lastPoint = mission.routePath[mission.routePath.length - 1];
                mission.currentLocation = lastPoint;
                
                if (mission.isReturning) {
                    // Finalize Return
                    console.log(`[FLEET ENGINE] ${driverId} completed return. Finalizing...`);
                    this.finalizeReturn(driverId, mission.crisisId);
                    this.activeMissions.delete(driverId);
                } else {
                    // Reached DropZone
                    mission.state = 'AT_DESTINATION';
                    console.log(`[FLEET ENGINE] ${driverId} reached destination.`);
                    const io = getIO();
                    if (io) io.emit('mission:arrived_destination', { driverId, crisisId: mission.crisisId });
                }
                continue;
            }

            // Interpolate position
            let routeIndex = 0;
            for (let i = 0; i < mission.cumulativeDistances.length - 1; i++) {
                if (mission.totalDistanceTraveled >= mission.cumulativeDistances[i] && mission.totalDistanceTraveled < mission.cumulativeDistances[i + 1]) {
                    routeIndex = i;
                    break;
                }
            }

            const p1 = mission.routePath[routeIndex];
            const p2 = mission.routePath[routeIndex + 1];
            if (!p1 || !p2) continue;

            const segmentStartDist = mission.cumulativeDistances[routeIndex];
            const segmentLength = mission.cumulativeDistances[routeIndex + 1] - segmentStartDist;
            const ratio = segmentLength > 0 ? (mission.totalDistanceTraveled - segmentStartDist) / segmentLength : 0;

            const lat = p1[0] + (p2[0] - p1[0]) * ratio;
            const lng = p1[1] + (p2[1] - p1[1]) * ratio;
            mission.currentLocation = [lat, lng];

            // Calculate heading
            const dy = p2[0] - p1[0];
            const dx = p2[1] - p1[1];
            mission.heading = (Math.atan2(dx, dy) * 180 / Math.PI);

            // Compute remaining ETA & Distance
            const remainingDist = mission.totalRouteLength - mission.totalDistanceTraveled;
            const remainingKm = remainingDist * 111;
            const secondsRemaining = speedDegPerSec > 0 ? Math.max(0, Math.floor(remainingDist / speedDegPerSec)) : 0;

            telemetryBatch.push({
                driverId,
                driverName: mission.driverName,
                location: mission.currentLocation,
                heading: mission.heading,
                state: mission.state,
                crisisId: mission.crisisId,
                remainingKm,
                secondsRemaining
            });
        }

        const io = getIO();
        if (io) {
            // Emit to all clients (drivers and admin), always emit to sync zero-truck state
            io.emit('fleet:telemetry', telemetryBatch);
        }
    }

    async finalizeReturn(driverId, crisisId) {
        try {
            const { CrisisService } = await import('../services/crisis.service.js');
            await CrisisService.deleteCrisis(crisisId, 'system');
            console.log(`[FLEET ENGINE] Auto-finalized return for ${driverId}`);
            
            const io = getIO();
            if (io) io.emit('mission:completed', { driverId, crisisId });
        } catch (err) {
            console.error(`[FLEET ENGINE] Failed to finalize return for ${driverId}:`, err.message);
        }
    }

    httpPost(url) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            };
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.end();
        });
    }

    fetchOSRMRoute(startLat, startLng, endLat, endLng) {
        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson`;
        return new Promise((resolve) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.routes && json.routes[0]) {
                            resolve(json.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]));
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        console.error('[FLEET ENGINE] OSRM parse error:', e.message);
                        resolve(null);
                    }
                });
            }).on('error', () => {
                resolve(null);
            });
        });
    }
}

export const fleetEngine = new FleetEngine();
