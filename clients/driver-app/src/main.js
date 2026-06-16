import { socketManager } from './socketManager.js';

// --- State ---
let driverId = null;
let currentMission = null;
let map = null;
let truckMarker = null;
let destinationMarker = null;
let routePolyline = null;

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const driverIdInput = document.getElementById('driver-id');

const displayDriverId = document.getElementById('display-driver-id');
const connectionStatus = document.getElementById('connection-status');
const statusText = connectionStatus.querySelector('.status-text');

const idleView = document.getElementById('idle-view');
const routeView = document.getElementById('route-view');

const destName = document.getElementById('dest-name');
const destDistance = document.getElementById('dest-distance');
const cargoList = document.getElementById('cargo-list');
const btnStartRoute = document.getElementById('btn-start-route');
const btnUnload = document.getElementById('btn-unload');
const themeToggle = document.getElementById('theme-toggle');

const warehouseList = document.getElementById('warehouse-list');
const warehouseIdInput = document.getElementById('warehouse-id');
const warehouseCodeInput = document.getElementById('warehouse-code');
const btnLogin = document.getElementById('btn-login');

// --- Initialization ---
async function init() {
    updateWarehouseDropdown();
    setInterval(updateWarehouseDropdown, 3000);

    // Theme Toggle Logic
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
    }

    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            html.classList.add('light');
            localStorage.setItem('theme', 'light');
            if (map) setMapTheme('light');
        } else {
            html.classList.remove('light');
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            if (map) setMapTheme('dark');
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = driverIdInput.value.trim().toUpperCase();
        const warehouseId = warehouseIdInput.value;
        const warehouseCode = warehouseCodeInput.value;
        if (id && warehouseId) {
            login(id, warehouseId, warehouseCode);
        }
    });

    btnStartRoute.addEventListener('click', () => {
        btnStartRoute.classList.add('hidden');
        btnStartRoute.classList.remove('flex');
        socketManager.startEngine();
    });

    socketManager.on('dispatch:accepted', () => {
        dispatchModal.classList.add('hidden');
    });

    socketManager.on('server:cancel_mission', () => {
        alert("HQ has aborted this mission. You have been cleared to standby.");
        resetDashboard();
    });

    btnUnload.addEventListener('click', async () => {
        if (!currentMission) return;
        btnUnload.disabled = true;
        btnUnload.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Unloading...';
        
        try {
            const res = await fetch(`http://localhost:5000/api/v1/dispatch/${currentMission.crisisId}/return`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId })
            });
            if (res.ok) {
                console.log('Return journey initiated');
                // Hide unload button immediately since we are returning
                btnUnload.classList.add('hidden');
                btnUnload.classList.remove('flex');
                destName.textContent = 'Warehouse (Return)';
                cargoList.innerHTML = '<p class="text-sm opacity-60 col-span-2">Empty - Returning</p>';
            } else {
                console.error('Failed to initiate return');
                btnUnload.disabled = false;
                btnUnload.innerHTML = 'Unload Fleet <span class="material-symbols-outlined">move_down</span>';
            }
        } catch (e) {
            console.error('Network error during unload', e);
            btnUnload.disabled = false;
            btnUnload.innerHTML = 'Unload Fleet <span class="material-symbols-outlined">move_down</span>';
        }
    });
    
    document.getElementById('btn-logout').addEventListener('click', logout);

    // --- Server Event Handlers ---
    socketManager.on('status', updateConnectionStatus);
    socketManager.on('server:sync_state', handleSyncState);
    socketManager.on('fleet:telemetry', handleTelemetry);
    socketManager.on('driver:dispatch_requested', handleDispatchRequested);
    socketManager.on('dispatch:accepted', handleDispatchAccepted);
    socketManager.on('mission:arrived_destination', handleArrival);
    socketManager.on('mission:completed', handleCompleted);

    socketManager.on('driver:returning', (data) => {
        if (currentMission) {
            currentMission.routePath = data.route;
            currentMission.isReturning = true;
            // Swap origin and dest for return trip drawing
            initMap(currentMission.destCoords, currentMission.originCoords, data.route);
        }
    });
}

// --- Map Theme Handler ---
let darkTileLayer, lightTileLayer;
function setMapTheme(theme) {
    if (!map) return;
    if (theme === 'dark') {
        if (lightTileLayer) map.removeLayer(lightTileLayer);
        darkTileLayer.addTo(map);
    } else {
        if (darkTileLayer) map.removeLayer(darkTileLayer);
        lightTileLayer.addTo(map);
    }
}

// --- App Flow ---

async function updateWarehouseDropdown() {
    if (loginScreen.classList.contains('hidden')) return;
    try {
        const resCrises = await fetch('http://localhost:5000/api/v1/crises?limit=100');
        const crisesJson = await resCrises.json();
        const pendingByWarehouse = {};
        if (crisesJson.success && crisesJson.data) {
            crisesJson.data.forEach(c => {
                if (c.dispatchStatus === 'PENDING_DRIVER' && c.assignedWarehouseId) {
                    const whId = typeof c.assignedWarehouseId === 'object' ? c.assignedWarehouseId._id : c.assignedWarehouseId;
                    pendingByWarehouse[whId] = (pendingByWarehouse[whId] || 0) + 1;
                }
            });
        }

        const res = await fetch('http://localhost:5000/api/v1/warehouses');
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            const currentValue = warehouseIdInput.value;
            let newHtml = '';
            
            json.data.forEach(wh => {
                const emergencies = pendingByWarehouse[wh._id] || 0;
                const emergencyBadge = emergencies > 0 
                    ? `<span class="bg-statusCritical text-white text-[9px] px-2 py-0.5 rounded-full animate-pulse">${emergencies}🚨</span>` 
                    : `<span class="bg-lumenaDark/10 dark:bg-lumenaLight/10 text-[9px] px-2 py-0.5 rounded-full opacity-60">STANDBY</span>`;
                
                const isSelected = currentValue === wh._id;
                const borderClass = isSelected ? 'border-statusHigh ring-1 ring-statusHigh' : 'border-transparent';
                
                newHtml += `
                    <div class="warehouse-card flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border ${borderClass} cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-all" data-id="${wh._id}" data-code="${wh.code || ''}">
                        <div class="flex flex-col text-left">
                            <span class="font-bold text-xs">${wh.name}</span>
                            <span class="text-[9px] opacity-60 uppercase tracking-widest">${wh.code} • ${wh.trucks.available} Trucks</span>
                        </div>
                        <div>${emergencyBadge}</div>
                    </div>
                `;
            });
            
            // Only update DOM if options actually changed to avoid closing the dropdown unnecessarily
            // Simple comparison (ignoring selected class changes for simplicity, but good enough for now)
            if (!warehouseList.dataset.loadedHtml || warehouseList.dataset.loadedHtml !== newHtml) {
                warehouseList.innerHTML = newHtml;
                warehouseList.dataset.loadedHtml = newHtml;
                
                // Add click listeners to cards
                const cards = warehouseList.querySelectorAll('.warehouse-card');
                cards.forEach(card => {
                    card.addEventListener('click', () => {
                        // Deselect all
                        cards.forEach(c => c.classList.remove('border-statusHigh', 'ring-1', 'ring-statusHigh', 'border-transparent'));
                        cards.forEach(c => c.classList.add('border-transparent'));
                        
                        // Select this
                        card.classList.remove('border-transparent');
                        card.classList.add('border-statusHigh', 'ring-1', 'ring-statusHigh');
                        
                        warehouseIdInput.value = card.dataset.id;
                        warehouseCodeInput.value = card.dataset.code;
                        btnLogin.disabled = false;
                    });
                });
            }
        }
    } catch (e) {
        console.error("Failed to load warehouses:", e);
    }
}

async function login(id, warehouseId, warehouseCode) {
    if (!warehouseCode) {
        alert("Please select a warehouse first.");
        return;
    }
    
    // Dynamically build the regex based on the warehouse code
    // Example: if code is W2, regex is /^W2-\d+$/i
    const driverRegex = new RegExp(`^${warehouseCode}-\\d+$`, 'i');
    
    if (!driverRegex.test(id)) {
        alert(`Invalid Driver ID format for this warehouse. Please use an ID matching ${warehouseCode}-XX (e.g., ${warehouseCode}-01).`);
        return;
    }
    
    driverId = id;
    displayDriverId.textContent = driverId;
    
    // Switch Screens
    loginScreen.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        appScreen.classList.add('flex');
    }, 300);
    
    socketManager.connect(driverId, warehouseId);

    // Check if there are any pending dispatches we missed before logging in
    try {
        const res = await fetch(`http://localhost:5000/api/v1/dispatch/pending/${warehouseId}`);
        const json = await res.json();
        if (json.success && json.data && json.data.crisis) {
            handleDispatchRequested(json.data);
        }
    } catch (e) {
        console.error("Failed to check pending dispatches", e);
    }
}

function logout() {
    if (socketManager.socket) {
        socketManager.socket.disconnect();
    }
    
    driverId = null;
    currentMission = null;
    displayDriverId.textContent = 'DRV-###';
    resetDashboard();
    
    appScreen.classList.add('hidden');
    appScreen.classList.remove('flex');
    loginScreen.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
}

function resetDashboard() {
    idleView.classList.remove('hidden');
    routeView.classList.add('hidden');
    routeView.classList.remove('flex');
    btnStartRoute.classList.add('hidden');
    btnStartRoute.classList.remove('flex');
    btnUnload.classList.add('hidden');
    btnUnload.classList.remove('flex');
    btnUnload.disabled = false;
    btnUnload.innerHTML = 'Unload Fleet <span class="material-symbols-outlined">move_down</span>';
    currentMission = null;
}

function updateConnectionStatus(status) {
    const dot = connectionStatus.querySelector('.dot');
    if (status === 'connected') {
        connectionStatus.className = 'flex items-center gap-2 bg-statusLow/10 text-statusLow px-3 py-1.5 rounded-full border border-statusLow/20';
        dot.className = 'w-2 h-2 rounded-full bg-statusLow animate-pulse dot';
        statusText.textContent = 'Online';
    } else {
        connectionStatus.className = 'flex items-center gap-2 bg-statusCritical/10 text-statusCritical px-3 py-1.5 rounded-full border border-statusCritical/20';
        dot.className = 'w-2 h-2 rounded-full bg-statusCritical dot';
        statusText.textContent = 'Offline';
    }
}

// --- Handlers ---

function handleSyncState(mission) {
    console.log("Server synced state:", mission);
    currentMission = mission;
    
    setupMissionUI(mission);
}

function handleTelemetry(data) {
    if (!currentMission) return;
    
    // Update marker position
    const newPos = [data.location[0], data.location[1]];
    if (truckMarker && map) {
        truckMarker.setLatLng(newPos);
        map.panTo(newPos, { animate: true, duration: 0.5 });
    }

    // Update ETA & Distance
    if (data.state === 'DRIVING' || data.state === 'RETURNING') {
        const mins = Math.floor(data.secondsRemaining / 60).toString().padStart(2, '0');
        const secs = (data.secondsRemaining % 60).toString().padStart(2, '0');
        destDistance.textContent = `${data.remainingKm.toFixed(1)} km remaining`;
        document.getElementById('eta-time').textContent = `${mins}:${secs}`;
    }
}

function handleArrival() {
    if (!currentMission) return;
    currentMission.state = 'AT_DESTINATION';
    
    btnStartRoute.classList.add('hidden');
    btnStartRoute.classList.remove('flex');
    btnUnload.classList.remove('hidden');
    btnUnload.classList.add('flex');
    
    destDistance.textContent = "Arrived at DropZone";
    document.getElementById('eta-time').textContent = "00:00";
}

function handleCompleted() {
    alert("Mission accomplished. Returning to standby.");
    resetDashboard();
}

function setupMissionUI(mission) {
    idleView.classList.add('hidden');
    routeView.classList.remove('hidden');
    routeView.classList.add('flex');

    if (mission.isReturning) {
        destName.textContent = 'Warehouse (Return)';
        cargoList.innerHTML = '<p class="text-sm opacity-60 col-span-2">Empty - Returning</p>';
    } else {
        destName.textContent = mission.crisisName || 'Crisis Zone';
        cargoList.innerHTML = '';
        if (mission.manifest) {
            Object.entries(mission.manifest).forEach(([cat, qty]) => {
                if (qty > 0) cargoList.innerHTML += `<div class="bg-lumenaDark border border-lumenaLight/20 px-2 py-1 rounded-md text-[10px]">${qty} ${cat}</div>`;
            });
        } else {
            cargoList.innerHTML = '<p class="text-sm opacity-60 col-span-2">No Manifest</p>';
        }
    }

    // Initialize Map
    let startCoords = mission.originCoords;
    let destCoords = mission.destCoords;
    
    if (mission.isReturning) {
        startCoords = mission.destCoords;
        destCoords = mission.originCoords;
    }
    
    initMap(startCoords, destCoords, mission.routePath);

    // Update Button states based on exact server state
    btnStartRoute.classList.add('hidden');
    btnStartRoute.classList.remove('flex');
    btnUnload.classList.add('hidden');
    btnUnload.classList.remove('flex');

    if (mission.state === 'PENDING_START') {
        btnStartRoute.classList.remove('hidden');
        btnStartRoute.classList.add('flex');
        destDistance.textContent = "Ready to deploy";
        document.getElementById('eta-time').textContent = "--:--";
    } else if (mission.state === 'AT_DESTINATION') {
        btnUnload.classList.remove('hidden');
        btnUnload.classList.add('flex');
        destDistance.textContent = "Arrived at DropZone";
        document.getElementById('eta-time').textContent = "00:00";
    }

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 100);
}

// --- Map Drawing ---

function initMap(startCoords, endCoords, routePath) {
    if (!map) {
        const bengaluruBounds = L.latLngBounds(
            [12.6, 77.3],
            [13.3, 77.9] 
        );
        map = L.map('map', { 
            zoomControl: false,
            minZoom: 11,
            maxBounds: bengaluruBounds,
            maxBoundsViscosity: 1.0
        }).setView(startCoords, 14);
        
        darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO', maxZoom: 20, noWrap: true, bounds: bengaluruBounds
        });
        lightTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO', maxZoom: 20, noWrap: true, bounds: bengaluruBounds
        });

        if (document.documentElement.classList.contains('dark')) darkTileLayer.addTo(map);
        else lightTileLayer.addTo(map);

        L.control.zoom({ position: 'topleft' }).addTo(map);
        const resizeObserver = new ResizeObserver(() => { if (map) map.invalidateSize(); });
        resizeObserver.observe(document.getElementById('map'));
    }

    if (truckMarker) map.removeLayer(truckMarker);
    if (destinationMarker) map.removeLayer(destinationMarker);
    if (routePolyline) map.removeLayer(routePolyline);

    const destIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:#FF3B30; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow: 0 0 15px rgba(255,59,48,0.8);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    destinationMarker = L.marker(endCoords, { icon: destIcon }).addTo(map);

    const truckIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:#FF9500; width:28px; height:28px; border-radius:50%; border:3px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 15px rgba(255,149,0,0.8);"><span class="material-symbols-outlined" style="color:white; font-size:16px;">local_shipping</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
    truckMarker = L.marker(startCoords, { icon: truckIcon }).addTo(map);

    if (routePath && routePath.length > 0) {
        routePolyline = L.polyline(routePath, { color: '#8b5cf6', weight: 5, opacity: 0.8 }).addTo(map);
    }
    
    map.fitBounds(L.latLngBounds([startCoords, endCoords]), { padding: [50, 50] });
    setTimeout(() => map.invalidateSize(), 100);
}

// --- Dispatch Modal Logic ---
let pendingDispatchData = null;
const acceptModal = document.getElementById('accept-mission-modal');
const modalCrisisName = document.getElementById('modal-crisis-name');
const modalManifestPreview = document.getElementById('modal-manifest-preview');
const btnAcceptMission = document.getElementById('btn-accept-mission');

function handleDispatchRequested(data) {
    console.log("Dispatch requested:", data);
    pendingDispatchData = data;
    
    modalCrisisName.textContent = data.crisis.name;
    modalManifestPreview.innerHTML = '';
    if (data.manifest) {
        Object.entries(data.manifest).forEach(([cat, qty]) => {
            if (qty > 0) {
                modalManifestPreview.innerHTML += `<span class="bg-lumenaDark border border-lumenaLight/20 px-2 py-1 rounded-md text-[10px]">${qty} ${cat}</span>`;
            }
        });
    }

    acceptModal.classList.remove('hidden');
    acceptModal.classList.add('flex');
}

btnAcceptMission.addEventListener('click', async () => {
    if (!pendingDispatchData) return;
    
    btnAcceptMission.disabled = true;
    btnAcceptMission.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> LINKING...';
    
    try {
        const crisisId = pendingDispatchData.crisis._id;
        const res = await fetch(`http://localhost:5000/api/v1/dispatch/${crisisId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverId })
        });
        
        const json = await res.json();
        if (json.success) {
            // Setup UI based on the newly returned server-authoritative route
            currentMission = json.mission;
            
            acceptModal.classList.add('hidden');
            acceptModal.classList.remove('flex');
            
            setupMissionUI(currentMission);
            pendingDispatchData = null;
        } else {
            alert(json.error || 'Failed to accept dispatch.');
            if (json.error === 'Dispatch is not pending a driver') {
                acceptModal.classList.add('hidden');
                acceptModal.classList.remove('flex');
                pendingDispatchData = null;
            }
        }
    } catch (e) {
        alert("Network error.");
    } finally {
        btnAcceptMission.disabled = false;
        btnAcceptMission.innerHTML = 'ACCEPT MISSION <span class="material-symbols-outlined text-[18px]">check_circle</span>';
    }
});

function handleDispatchAccepted(data) {
    if (data.driverId === driverId && pendingDispatchData && pendingDispatchData.crisis._id === data.crisisId) {
        // We already accepted it, wait for our local fetch to resolve
    }
}

document.addEventListener('DOMContentLoaded', init);
