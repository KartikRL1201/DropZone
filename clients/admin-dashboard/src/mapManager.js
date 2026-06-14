class MapManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.markers = {}; 
        this.fleetMarkers = {}; // For live trucks
        this.routeLayers = {};  // For live routes
        this.warehouseLayers = {}; // For live warehouse popups
        this.landmarks = []; // Dynamically loaded
        this.hiddenMarkerIds = new Set();
    }

    init() {
        // Expanded Bounding box for Bengaluru and outskirts to allow easy panning
        const bengaluruBounds = L.latLngBounds(
            [12.6, 77.3], // Expanded South-West corner
            [13.3, 77.9]  // Expanded North-East corner
        );

        // Initialize map centered on Ejipura/Koramangala area
        this.map = L.map(this.containerId, {
            zoomControl: false,
            attributionControl: false,
            minZoom: 11, // Prevent zooming out to the whole world
            maxBounds: bengaluruBounds, // Restrict panning to Bengaluru
            maxBoundsViscosity: 1.0 // Bounces back if user tries to pan outside
        }).setView([12.9344, 77.6254], 13);

        // Predefine light and dark tile layers (Voyager has best road visibility for ecommerce vibe)
        this.lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19, noWrap: true, bounds: bengaluruBounds
        });
        this.darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19, noWrap: true, bounds: bengaluruBounds
        });

        // Set initial layer based on current DOM class
        const isDark = document.documentElement.classList.contains('dark');
        this.currentTiles = isDark ? this.darkTiles : this.lightTiles;
        this.currentTiles.addTo(this.map);

        // Store drawn route polylines
        this.routeLayers = {};

        // Render static HQ and landmarks
        this.renderLandmarks();
    }

    setTheme(isDark) {
        if (!this.map) return;
        this.map.removeLayer(this.currentTiles);
        this.currentTiles = isDark ? this.darkTiles : this.lightTiles;
        this.currentTiles.addTo(this.map);
    }

    async loadWarehouses() {
        try {
            const res = await fetch('http://localhost:5000/api/v1/warehouses', {
                headers: { 'Authorization': `Bearer ${window.MOCK_HQ_TOKEN || ''}` }
            });
            const result = await res.json();
            if (result.success) {
                this.landmarks = result.data;
                this.renderLandmarks();
            }
        } catch (error) {
            console.error('Failed to load warehouses:', error);
        }
    }

    renderLandmarks() {
        if (!this.map) return;
        
        // Remove old warehouse markers
        Object.values(this.warehouseLayers).forEach(layer => this.map.removeLayer(layer));
        this.warehouseLayers = {};

        this.landmarks.forEach(lm => {
            const isHq = lm.code === 'hq';
            let colorClass = 'bg-gray-400 text-white border-gray-500';
            let size = 'w-6 h-6 text-[12px]';
            let zIndex = 200;

            if (isHq) {
                colorClass = 'bg-lumenaDark text-lumenaLight dark:bg-lumenaLight dark:text-lumenaDark border-white shadow-xl';
                size = 'w-10 h-10 text-[20px]';
                zIndex = 500;
            } else {
                colorClass = 'bg-blue-600 text-white border-blue-300 shadow-md';
                size = 'w-8 h-8 text-[16px]';
                zIndex = 400;
            }

            const iconHtml = `
                <div class="flex items-center justify-center rounded-full border-[2px] ${colorClass} ${size} transition-transform hover:scale-110">
                    <span class="material-symbols-outlined" style="font-size: inherit">${isHq ? 'warehouse' : 'inventory_2'}</span>
                </div>
            `;
            const dim = isHq ? 40 : 32;
            const icon = L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [dim, dim], iconAnchor: [dim/2, dim/2] });
            
            // Extract lat/lng
            const lng = lm.location.coordinates[0];
            const lat = lm.location.coordinates[1];
            
            // Build the Lumena Popup
            let inventoryHtml = '';
            lm.inventory.forEach(item => {
                inventoryHtml += `
                    <div class="flex justify-between items-center text-[10px] font-mono border-b border-white/5 pb-1 mb-1">
                        <span class="opacity-60 uppercase">${item.category}</span>
                        <span class="font-bold ${item.quantity < 50 ? 'text-statusCritical' : 'text-statusHigh'}">${item.quantity}</span>
                    </div>
                `;
            });

            const popupHtml = `
                <div class="font-sans text-black p-2 min-w-[200px]">
                    <div class="flex items-center justify-between mb-2 pb-2 border-b border-black/10">
                        <h4 class="font-bold text-sm tracking-tight uppercase">${lm.name}</h4>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold ${lm.trucks.available > 0 ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}">
                            ${lm.trucks.available}/${lm.trucks.total} TRUCKS
                        </span>
                    </div>
                    <div class="flex flex-col gap-1 text-[10px] font-bold opacity-80 uppercase">
                        ${inventoryHtml}
                    </div>
                </div>
            `;

            const marker = L.marker([lat, lng], {icon: icon, zIndexOffset: zIndex})
              .addTo(this.map)
              .bindPopup(popupHtml, {
                  minWidth: 200
              });
              
            // Also add a minimal tooltip for hover
            marker.bindTooltip(lm.name, { direction: 'top', offset: [0, -(dim/2 - 5)], className: 'font-sans font-bold text-[10px] tracking-widest' });

            this.warehouseLayers[lm._id] = marker;
        });
    }

    renderRoute(routeId, polylineCoords) {
        if (!this.map) return;
        
        // Remove existing route if any
        if (this.routeLayers[routeId]) {
            this.map.removeLayer(this.routeLayers[routeId]);
        }

        // Draw Zepto-style thick purple line
        const routeLine = L.polyline(polylineCoords, {
            color: '#8B3DFF', // Vibrant Purple
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round'
        }).addTo(this.map);

        this.routeLayers[routeId] = routeLine;
    }

    renderMarkers(crises) {
        if (!this.map) return;

        // Remove old markers
        Object.values(this.markers).forEach(marker => this.map.removeLayer(marker));
        this.markers = {};

        if (!crises || crises.length === 0) return;

        const bounds = L.latLngBounds();
        let hasValidCoordinates = false;

        crises.forEach(crisis => {
            if (this.hiddenMarkerIds.has(crisis._id)) return;

            const geo = crisis.epicenter || crisis.location;
            if (!geo || !geo.coordinates || geo.coordinates.length !== 2) {
                return;
            }
            
            const [lng, lat] = geo.coordinates;
            if (isNaN(lat) || isNaN(lng) || lat === null || lng === null) {
                return;
            }

            const latLng = [lat, lng];
            
            let colorClass = 'bg-statusLow';
            if (crisis.severity === 'CRITICAL') colorClass = 'bg-statusCritical';
            else if (crisis.severity === 'HIGH') colorClass = 'bg-statusHigh';
            else if (crisis.severity === 'MODERATE') colorClass = 'bg-statusMedium';

            let emoji = '⚠️';
            const nameLower = (crisis.name || '').toLowerCase();
            if (nameLower.includes('fire')) emoji = '🔥';
            else if (nameLower.includes('flood') || nameLower.includes('water')) emoji = '🌊';
            else if (nameLower.includes('medical') || nameLower.includes('health')) emoji = '🏥';
            else if (nameLower.includes('earthquake') || nameLower.includes('collapse')) emoji = '🏢';
            else if (nameLower.includes('power')) emoji = '⚡';

            const markerHtml = `
                <div class="relative w-8 h-8 rounded-full ${colorClass} shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center justify-center text-sm">
                    <div class="absolute inset-0 rounded-full border-2 border-white animate-pulse"></div>
                    ${emoji}
                </div>`;
            const icon = L.divIcon({ className: 'custom-div-icon', html: markerHtml, iconSize: [32, 32], iconAnchor: [16, 16] });
            
            const marker = L.marker(latLng, {icon: icon}).addTo(this.map);
            
            const getDemands = (severity) => {
                switch(severity) {
                    case 'CRITICAL': return { MED: '50-150', H2O: '100-250', FOOD: '80-120', BLKTS: '30-80' };
                    case 'HIGH': return { MED: '30-80', H2O: '50-120', FOOD: '40-80', BLKTS: '10-40' };
                    case 'MODERATE': return { MED: '10-30', H2O: '20-60', FOOD: '15-35', BLKTS: '5-15' };
                    case 'LOW': return { MED: '1-10', H2O: '10-30', FOOD: '5-15', BLKTS: '1-10' };
                    default: return { MED: '5-15', H2O: '15-30', FOOD: '5-15', BLKTS: '2-8' };
                }
            };
            const demands = getDemands(crisis.severity);

            const crisisIdString = crisis._id.substring(crisis._id.length - 4).toUpperCase();
            marker.bindPopup(`
                <div class="font-sans text-black p-2 min-w-[150px]">
                    <div class="flex justify-between items-start mb-1">
                        <div class="font-bold text-sm tracking-tight pr-4">${crisis.name || 'Unknown Crisis'}</div>
                        <div class="text-[9px] font-bold tracking-widest uppercase opacity-40">REQ-${crisisIdString}</div>
                    </div>
                    <div class="text-[9px] font-bold tracking-widest uppercase opacity-60 mb-2 border-b border-black/10 pb-2">Severity: ${crisis.severity}</div>
                    <div class="text-[9px] font-bold opacity-80 uppercase grid grid-cols-2 gap-1">
                        <div>MED: <span class="opacity-60">${demands.MED}</span></div>
                        <div>H2O: <span class="opacity-60">${demands.H2O}</span></div>
                        <div>FOOD: <span class="opacity-60">${demands.FOOD}</span></div>
                        <div>BLKTS: <span class="opacity-60">${demands.BLKTS}</span></div>
                    </div>
                </div>
            `);

            this.markers[crisis._id] = marker;
            bounds.extend(latLng);
            hasValidCoordinates = true;
        });

        // Smoothly fly to the new bounding box
        const mapContainer = this.map.getContainer();
        const mapSection = document.getElementById('map-section');
        const isVisible = mapContainer.offsetParent !== null && 
                         (!mapSection || !mapSection.classList.contains('hidden'));

        if (hasValidCoordinates && isVisible) {
            try {
                // Ensure Leaflet's internal size cache is up to date before flying
                this.map.invalidateSize();
                this.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 1.5 });
            } catch(e) {
                console.warn("Leaflet flyToBounds error:", e);
            }
        }
    }

    renderFleet(vehicles) {
        if (!this.map) return;

        // Keep track of active vehicle IDs
        const activeIds = new Set(vehicles.map(v => v.id));

        // Remove markers and routes for vehicles that are no longer active
        Object.keys(this.fleetMarkers).forEach(id => {
            if (!activeIds.has(id)) {
                this.map.removeLayer(this.fleetMarkers[id]);
                delete this.fleetMarkers[id];
                
                if (this.routeLayers[id]) {
                    this.map.removeLayer(this.routeLayers[id]);
                    delete this.routeLayers[id];
                }
            }
        });

        vehicles.forEach(vehicle => {
            if (!this.fleetMarkers[vehicle.id]) {
                // Create a sleek, premium top-down truck marker
                const iconHtml = `
                    <div class="transition-transform duration-[33ms] flex items-center justify-center w-12 h-12" style="transform: rotate(${vehicle.heading || 0}deg)">
                        <div class="relative w-3.5 h-7 bg-lumenaDark dark:bg-lumenaLight rounded-[3px] shadow-[0_5px_15px_rgba(0,0,0,0.4)] border border-white/10">
                            <!-- Windshield -->
                            <div class="absolute top-1.5 left-0.5 right-0.5 h-1.5 bg-black/40 dark:bg-black/60 rounded-sm"></div>
                            <!-- Roof Details -->
                            <div class="absolute top-4 left-1 right-1 h-2 bg-white/10 rounded-sm"></div>
                            <!-- Headlights -->
                            <div class="absolute -top-0.5 left-0.5 w-0.5 h-0.5 bg-yellow-300 shadow-[0_-2px_5px_rgba(253,224,71,0.8)] rounded-full"></div>
                            <div class="absolute -top-0.5 right-0.5 w-0.5 h-0.5 bg-yellow-300 shadow-[0_-2px_5px_rgba(253,224,71,0.8)] rounded-full"></div>
                            <!-- Taillights -->
                            <div class="absolute -bottom-0.5 left-0.5 w-1 h-0.5 bg-red-500 rounded-sm"></div>
                            <div class="absolute -bottom-0.5 right-0.5 w-1 h-0.5 bg-red-500 rounded-sm"></div>
                        </div>
                    </div>
                `;
                const icon = L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [48, 48], iconAnchor: [24, 24] });
                
                const marker = L.marker(vehicle.location, {icon: icon, zIndexOffset: 1000}).addTo(this.map);
                marker.bindTooltip(`Unit ${vehicle.id}`, { direction: 'top', offset: [0, -15], className: 'font-sans font-bold text-[9px] tracking-widest uppercase' });
                this.fleetMarkers[vehicle.id] = marker;
            } else {
                // Animate existing truck smoothly
                const marker = this.fleetMarkers[vehicle.id];
                marker.setLatLng(vehicle.location);
                
                // Update rotation
                const iconEl = marker.getElement();
                if (iconEl) {
                    const innerDiv = iconEl.querySelector('div.transition-transform');
                    if (innerDiv) innerDiv.style.transform = `rotate(${vehicle.heading || 0}deg)`;
                }
            }
        });
    }
}

export const mapManager = new MapManager('map');
