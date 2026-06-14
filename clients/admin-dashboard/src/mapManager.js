class MapManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.markers = {}; 
        this.fleetMarkers = {}; // For live trucks
        this.routeLayers = {};  // For live routes
        
        // Static Warehouses scattered across Bengaluru
        this.landmarks = [
            { id: 'hq', name: 'Central Command HQ (Ejipura)', location: [12.9344, 77.6254], icon: 'warehouse', type: 'hq' },
            { id: 'w1', name: 'Peenya Hub (NW)', location: [13.0285, 77.5197], icon: 'inventory_2', type: 'warehouse' },
            { id: 'w2', name: 'Whitefield Hub (E)', location: [12.9698, 77.7499], icon: 'inventory_2', type: 'warehouse' },
            { id: 'w3', name: 'Electronic City Hub (S)', location: [12.8452, 77.6602], icon: 'inventory_2', type: 'warehouse' },
            { id: 'w4', name: 'Yelahanka Hub (N)', location: [13.1007, 77.5963], icon: 'inventory_2', type: 'warehouse' },
            { id: 'w5', name: 'Kengeri Hub (SW)', location: [12.9177, 77.4838], icon: 'inventory_2', type: 'warehouse' },
            { id: 'w6', name: 'KR Puram Hub (NE)', location: [13.0084, 77.6959], icon: 'inventory_2', type: 'warehouse' },
            { id: 'w7', name: 'Bannerghatta Hub (Deep S)', location: [12.8158, 77.5844], icon: 'inventory_2', type: 'warehouse' }
        ];
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

    renderLandmarks() {
        this.landmarks.forEach(lm => {
            let colorClass = 'bg-gray-400 text-white border-gray-500';
            let size = 'w-6 h-6 text-[12px]';
            let zIndex = 200;

            if (lm.type === 'hq') {
                colorClass = 'bg-lumenaDark text-lumenaLight dark:bg-lumenaLight dark:text-lumenaDark border-white shadow-xl';
                size = 'w-10 h-10 text-[20px]';
                zIndex = 500;
            } else if (lm.type === 'warehouse') {
                colorClass = 'bg-blue-600 text-white border-blue-300 shadow-md';
                size = 'w-8 h-8 text-[16px]';
                zIndex = 400;
            } else if (lm.type === 'medical') {
                colorClass = 'bg-red-500 text-white border-red-300 shadow-sm';
            } else if (lm.type === 'school') {
                colorClass = 'bg-yellow-500 text-black border-yellow-200 shadow-sm';
            } else if (lm.type === 'public') {
                colorClass = 'bg-green-600 text-white border-green-300 shadow-sm';
            }

            const iconHtml = `
                <div class="flex items-center justify-center rounded-full border-[2px] ${colorClass} ${size}">
                    <span class="material-symbols-outlined" style="font-size: inherit">${lm.icon}</span>
                </div>
            `;
            const dim = lm.type === 'hq' ? 40 : (lm.type === 'warehouse' ? 32 : 24);
            const icon = L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [dim, dim], iconAnchor: [dim/2, dim/2] });
            
            L.marker(lm.location, {icon: icon, zIndexOffset: zIndex}).addTo(this.map)
              .bindTooltip(lm.name, { direction: 'top', offset: [0, -(dim/2 - 5)], className: 'font-sans font-bold text-[10px] tracking-widest' });
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
            const geo = crisis.epicenter || crisis.location;
            if (!geo || !geo.coordinates || geo.coordinates.length !== 2) {
                return;
            }
            
            const [lng, lat] = geo.coordinates;
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
            
            marker.bindPopup(`
                <div class="font-sans text-black p-1">
                    <div class="font-bold text-sm mb-1 tracking-tight">${crisis.name || 'Unknown Crisis'}</div>
                    <div class="text-[9px] font-bold tracking-widest uppercase opacity-60">Severity: ${crisis.severity}</div>
                </div>
            `);

            this.markers[crisis._id] = marker;
            bounds.extend(latLng);
            hasValidCoordinates = true;
        });

        // Smoothly fly to the new bounding box
        if (hasValidCoordinates) {
            this.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 1.5 });
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
