import { socketManager } from './socketManager.js';
import { queueManager } from './queue.js';
import { mapManager } from './mapManager.js';
import { fleetManager } from './fleetManager.js';
import { inventoryManager } from './inventory.js';

// Connection UI Elements
const indicator = document.getElementById('connection-indicator');
const indicatorText = document.getElementById('connection-text');

// Auth Token (Mocking for now, eventually grab from login)
// In a real app we'd fetch this from localStorage after auth
window.MOCK_HQ_TOKEN = 'mock-hq-token-123';
const MOCK_HQ_TOKEN = window.MOCK_HQ_TOKEN;

// Setup connection status listeners
socketManager.on('status', (status) => {
    if (status === 'connected') {
        indicator.className = 'w-2 h-2 rounded-full bg-statusCritical live-pulse';
        indicatorText.innerText = 'Live Stream';
        indicatorText.classList.remove('opacity-40');
    } else if (status === 'disconnected') {
        indicator.className = 'w-2 h-2 rounded-full bg-statusMedium live-pulse';
        indicatorText.innerText = 'Reconnecting...';
        indicatorText.classList.add('opacity-40');
    } else if (status === 'error') {
        indicator.className = 'w-2 h-2 rounded-full bg-lumenaLight/20 dark:bg-lumenaDark/20';
        indicatorText.innerText = 'Connection Error';
    }
});

const showNotification = (title, message) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'bg-lumenaLight/90 dark:bg-lumenaDark/90 backdrop-blur-md p-4 rounded-xl shadow-2xl border editorial-border text-black dark:text-white w-72 transform transition-all duration-300 translate-x-full opacity-0';
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-statusCritical">warning</span>
            <div>
                <h4 class="font-bold text-sm leading-tight">${title}</h4>
                <p class="text-[10px] font-bold tracking-widest uppercase opacity-60 mt-1">${message}</p>
            </div>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
};

// Setup crisis event listeners to auto-refresh table and map
socketManager.on('crisis:new', (data) => {
    console.log('New crisis reported, refreshing queue...', data);
    
    const lat = data.epicenter?.coordinates?.[1]?.toFixed(4) || 'Unknown';
    const lng = data.epicenter?.coordinates?.[0]?.toFixed(4) || 'Unknown';
    showNotification('New Crisis Detected', `${data.name}<br/>LOC: ${lat}, ${lng}`);
    
    queueManager.fetchAndRender();
});

socketManager.on('crisis:updated', (data) => {
    console.log('Crisis updated, refreshing queue...', data);
    queueManager.fetchAndRender();
});

socketManager.on('crisis:deleted', (crisisId) => {
    console.log('Crisis deleted:', crisisId);
    import('./fleetManager.js').then(({ fleetManager }) => {
        fleetManager.removeTruckForCrisis(crisisId);
    });
    queueManager.fetchAndRender();
});

socketManager.on('warehouse:updated', (data) => {
    console.log('Warehouse updated, redrawing map markers...', data);
    const index = mapManager.landmarks.findIndex(lm => lm._id === data._id);
    if (index !== -1) {
        mapManager.landmarks[index] = data;
        mapManager.renderLandmarks();
    }
});

// Telemetry Listener
socketManager.on('driver:position', (data) => {
    if (data.location) {
        import('./fleetManager.js').then(({ fleetManager }) => {
            fleetManager.updateTelemetry(data.driverId, data.location.lat, data.location.lng);
        });
    }
});

socketManager.on('driver:returning', (data) => {
    if (data.route) {
        import('./fleetManager.js').then(({ fleetManager }) => {
            fleetManager.handleReturnRoute(data.driverId, data.crisisId, data.route);
        });
    }
});

socketManager.on('dispatch:accepted', (data) => {
    console.log('Driver Accepted Dispatch!', data);
    showNotification('Driver Deployed', `Truck En Route for Crisis ID: ${data.crisisId.substring(0, 6)}`);
    
    // Now we dispatch the truck in the UI
    import('./queue.js').then(({ queueManager }) => {
        queueManager.fetchAndRender(); // Fetch new queue data so AWAITING DRIVER becomes EN ROUTE!
        
        const crisis = queueManager.crises.find(c => c._id === data.crisisId);
        if (crisis) {
            import('./fleetManager.js').then(({ fleetManager }) => {
                fleetManager.dispatchTruck(crisis, data.driverId);
            });
        }
    });
});

// Theme Toggle Logic
const themeToggleBtn = document.getElementById('theme-toggle');

function initTheme() {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    themeToggleBtn?.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        // Dynamically swap the map tiles
        mapManager.setTheme(isDark);
    });
}

// Map Initialization Hook
async function initMap() {
    mapManager.init();
    await mapManager.loadWarehouses();
    inventoryManager.render();
}

function initTabs() {
    const navQueue = document.getElementById('nav-queue');
    const navInventory = document.getElementById('nav-inventory');
    const navSimulator = document.getElementById('nav-simulator');
    const viewQueue = document.getElementById('view-queue');
    const viewInventory = document.getElementById('view-inventory');
    const viewSimulator = document.getElementById('view-simulator');
    const queueSearch = document.getElementById('queue-search');
    const sectionTitle = document.getElementById('section-title');

    if(!navQueue) return;

    const navSlider = document.getElementById('nav-slider');
    const mapSection = document.getElementById('map-section');

    const updateSlider = (activeNav) => {
        if (!navSlider || !activeNav) return;
        navSlider.style.width = `${activeNav.offsetWidth}px`;
        navSlider.style.left = `${activeNav.offsetLeft}px`;
    };

    const switchTab = (activeNav, activeView, titleText) => {
        // Reset all navs
        [navQueue, navInventory, navSimulator].forEach(nav => {
            if(!nav) return;
            nav.classList.remove('opacity-100');
        });
        
        // Hide all views
        [viewQueue, viewInventory, viewSimulator].forEach(view => {
            if(view) view.classList.add('hidden');
        });

        // Activate selected nav
        activeNav.classList.add('opacity-100');
        activeView.classList.remove('hidden');

        updateSlider(activeNav);

        // Map section only for queue
        if(mapSection) {
            if(activeView === viewQueue) {
                mapSection.classList.remove('hidden');
                setTimeout(() => {
                    if (mapManager.map) mapManager.map.invalidateSize();
                }, 100);
            }
            else mapSection.classList.add('hidden');
        }

        // Update section title
        if(sectionTitle) sectionTitle.innerText = titleText;

        // Toggle clear button and search
        const btnClear = document.getElementById('btn-clear-queue');
        if (activeView === viewQueue) {
            if (queueSearch) queueSearch.classList.remove('hidden');
            if (btnClear) btnClear.classList.remove('hidden');
        } else {
            if (queueSearch) queueSearch.classList.add('hidden');
            if (btnClear) btnClear.classList.add('hidden');
        }
        // Search bar only for queue
        if(queueSearch) {
            if(activeView === viewQueue) queueSearch.classList.remove('hidden');
            else queueSearch.classList.add('hidden');
        }
    };

    // Initialize slider position
    setTimeout(() => updateSlider(navQueue), 100);

    navQueue.addEventListener('click', () => switchTab(navQueue, viewQueue, 'Active Queue'));
    if(navInventory) navInventory.addEventListener('click', () => switchTab(navInventory, viewInventory, 'Inventory Status'));
    if(navSimulator) navSimulator.addEventListener('click', () => switchTab(navSimulator, viewSimulator, 'Simulation Engine'));
}

function initSimulator() {
    const btnRandom = document.getElementById('btn-random-crisis');
    const modal = document.getElementById('map-crisis-modal');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCoords = document.getElementById('modal-coords');
    const modalTitle = document.getElementById('modal-title');
    const modalSeverity = document.getElementById('modal-severity');

    if(!btnRandom) return;

    const btnInteractiveMap = document.getElementById('btn-interactive-map');
    const btnMapClose = document.getElementById('map-close-btn');
    const mapSection = document.getElementById('map-section');
    const viewQueue = document.getElementById('view-queue');

    if (btnInteractiveMap) {
        btnInteractiveMap.addEventListener('click', () => {
            mapSection.classList.remove('hidden');
            mapSection.classList.add('map-modal-mode');
            setTimeout(() => {
                if (mapManager.map) mapManager.map.invalidateSize();
            }, 100);
        });
    }

    if (btnMapClose) {
        btnMapClose.addEventListener('click', () => {
            mapSection.classList.remove('map-modal-mode');
            // If we are not on the Queue tab, hide the map section again
            if (viewQueue && viewQueue.classList.contains('hidden')) {
                mapSection.classList.add('hidden');
            }
            setTimeout(() => {
                if (mapManager.map) mapManager.map.invalidateSize();
            }, 100);
        });
    }

    let currentClickCoords = null;

    const getAddressFromCoords = async (lat, lng) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
                headers: { 'Accept-Language': 'en' }
            });
            const data = await res.json();
            const addr = data.address;
            if (addr) {
                return addr.neighbourhood || addr.suburb || addr.city_district || addr.road || addr.village || "Unknown Area";
            }
        } catch(e) {}
        return "Unknown Area";
    };

    const postCrisis = async (payload) => {
        try {
            const response = await fetch('http://localhost:5000/api/v1/crises', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MOCK_HQ_TOKEN}`
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                const result = await response.json();
                const crisis = result.data;
                console.log('Crisis created:', crisis);
                // Queue gets updated, but truck is NOT dispatched automatically anymore.
                queueManager.fetchAndRender();
            } else {
                console.error("Failed to post crisis", await response.text());
            }
        } catch(e) {
            console.error(e);
        }
    };

    window.deployFleet = async (id) => {
        // Find the crisis in the current queue data
        const crisis = queueManager.crises.find(c => c._id === id);
        if (!crisis || crisis.status === 'MONITORING') return;

        // Optimistic UI update
        crisis.status = 'MONITORING';
        crisis.dispatchStatus = 'PENDING_DRIVER';
        queueManager.render(queueManager.crises);

        // Call backend dispatch to allocate trucks and deduct inventory
        try {
            const response = await fetch(`http://localhost:5000/api/v1/dispatch/${id}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MOCK_HQ_TOKEN}` 
                }
            });
            const result = await response.json();
            if (response.ok && result.data) {
                // Synchronously update warehouse UI to prevent any desync
                if (result.warehouse) {
                    const index = mapManager.landmarks.findIndex(lm => lm._id === result.warehouse._id);
                    if (index !== -1) {
                        mapManager.landmarks[index] = result.warehouse;
                        mapManager.renderLandmarks();
                    }
                }
                
                // fleetManager.dispatchTruck(result.data); // Removed: We wait for 'dispatch:accepted' socket event from Driver App!
            } else if (response.status === 409 && result.fallback) {
                // Show Fallback Modal
                const modal = document.getElementById('fallback-modal');
                const modalText = document.getElementById('fallback-modal-text');
                const btnCancel = document.getElementById('btn-fallback-cancel');
                const btnConfirm = document.getElementById('btn-fallback-confirm');

                const { nearest, alternative } = result.fallback;
                
                modalText.innerHTML = `Nearest Hub <strong>(${nearest.name})</strong> is out of stock.<br/>Alternative: <strong>${alternative.name}</strong>.<br/><br/>Do you want to dispatch from the alternative?`;
                modal.classList.remove('hidden');

                // Clear old listeners
                const newCancel = btnCancel.cloneNode(true);
                const newConfirm = btnConfirm.cloneNode(true);
                btnCancel.parentNode.replaceChild(newCancel, btnCancel);
                btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

                newCancel.addEventListener('click', () => {
                    modal.classList.add('hidden');
                    // Revert UI
                    crisis.status = 'ACTIVE';
                    crisis.dispatchStatus = 'NONE';
                    queueManager.render(queueManager.crises);
                });

                newConfirm.addEventListener('click', async () => {
                    modal.classList.add('hidden');
                    // Force dispatch with alternative warehouse
                    try {
                        const resAlt = await fetch(`http://localhost:5000/api/v1/dispatch/${id}`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${MOCK_HQ_TOKEN}` 
                            },
                            body: JSON.stringify({ warehouseId: alternative._id })
                        });
                        const resAltJson = await resAlt.json();
                        if (resAlt.ok && resAltJson.data) {
                            if (resAltJson.warehouse) {
                                const index = mapManager.landmarks.findIndex(lm => lm._id === resAltJson.warehouse._id);
                                if (index !== -1) {
                                    mapManager.landmarks[index] = resAltJson.warehouse;
                                    mapManager.renderLandmarks();
                                }
                            }
                            // fleetManager.dispatchTruck(resAltJson.data); // Removed: Waiting for Driver app
                        } else {
                            alert(resAltJson.error || "Dispatch failed on fallback");
                            crisis.status = 'ACTIVE';
                            crisis.dispatchStatus = 'NONE';
                            queueManager.render(queueManager.crises);
                        }
                    } catch(e) {
                        console.error(e);
                        crisis.status = 'ACTIVE';
                        crisis.dispatchStatus = 'NONE';
                        queueManager.render(queueManager.crises);
                    }
                });
            } else {
                console.error("Dispatch failed:", result.error);
                // Revert optimistic UI
                crisis.status = 'ACTIVE';
                crisis.dispatchStatus = 'NONE';
                queueManager.render(queueManager.crises);
                alert(result.error || "Dispatch failed");
            }
        } catch(e) { 
            console.error(e); 
            // Revert optimistic UI
            crisis.status = 'ACTIVE';
            queueManager.render(queueManager.crises);
        }
    };

    window.deleteCrisis = async (id) => {
        const crisis = queueManager.crises.find(c => c._id === id);
        
        // Optimistically animate UI removal
        const row = document.getElementById(`crisis-row-${id}`);
        if (row) {
            row.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            row.style.overflow = 'hidden';
            row.style.opacity = '0';
            row.style.transform = 'scale(0.95)';
            row.style.maxHeight = row.offsetHeight + 'px';
            
            // Force reflow
            void row.offsetWidth;
            
            row.style.maxHeight = '0px';
            row.style.paddingTop = '0px';
            row.style.paddingBottom = '0px';
            row.style.marginTop = '0px';
            row.style.marginBottom = '0px';
            row.style.borderWidth = '0px';

            setTimeout(() => {
                if (row.parentNode) row.parentNode.removeChild(row);
                // Also manually re-render just to be safe
                queueManager.render(queueManager.crises);
            }, 500);
        }
        
        // Optimistically remove truck from map immediately
        fleetManager.removeTruckForCrisis(id);
        
        // Remove from local data array
        queueManager.crises = queueManager.crises.filter(c => c._id !== id);
        
        // Background network tasks
        (async () => {
            // Return fleet if it was dispatched
            if (crisis && crisis.status === 'MONITORING') {
                try {
                    const response = await fetch(`http://localhost:5000/api/v1/dispatch/return/${id}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${MOCK_HQ_TOKEN}` }
                    });
                    const result = await response.json();
                    if (response.ok && result.warehouse) {
                        const index = mapManager.landmarks.findIndex(lm => lm._id === result.warehouse._id);
                        if (index !== -1) {
                            mapManager.landmarks[index] = result.warehouse;
                            mapManager.renderLandmarks();
                        }
                    }
                } catch(e) { console.error(e); }
            }

            try {
                await fetch(`http://localhost:5000/api/v1/crises/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${MOCK_HQ_TOKEN}` }
                });
                // We do not fetchAndRender() immediately to preserve the animation
                // WebSockets or explicit refresh will handle syncing later if needed
            } catch(e) { console.error(e); }
        })();
    };

    window.toggleRequests = async (id) => {
        const container = document.getElementById(`requests-container-${id}`);
        if (!container) return;
        
        // Toggle visibility
        if (!container.classList.contains('hidden')) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');
        container.innerHTML = '<div class="text-center opacity-40 text-xs font-bold py-2">Loading requests...</div>';
        
        try {
            const response = await fetch(`http://localhost:5000/api/v1/requests?crisisId=${id}`, {
                headers: { 'Authorization': `Bearer ${MOCK_HQ_TOKEN}` }
            });
            const result = await response.json();
            
            if (result.success && result.data && result.data.length > 0) {
                let html = '<div class="flex flex-col gap-2">';
                result.data.forEach(req => {
                    const date = new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    html += `
                        <div class="bg-white/5 dark:bg-black/20 p-3 rounded flex justify-between items-center border border-white/5">
                            <div class="flex flex-col gap-1">
                                <span class="text-xs font-bold">${req.requesterName} <span class="opacity-50 font-normal">(${req.contactPhone})</span></span>
                                <span class="text-[10px] uppercase tracking-widest opacity-60 flex gap-2">
                                    <span><span class="material-symbols-outlined text-[10px]">person</span> ${req.peopleCount}</span>
                                    <span><span class="material-symbols-outlined text-[10px]">location_on</span> ${req.locationAddress || 'Unknown'}</span>
                                </span>
                            </div>
                            <div class="flex gap-2 text-xs font-bold">
                                ${req.items.map(item => `
                                    <div class="bg-orange-500/10 text-orange-500 px-2 py-1 rounded">
                                        ${item.quantityNeeded} <span class="opacity-70">${item.category}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<div class="text-center opacity-40 text-xs font-bold py-2">No citizen requests found for this incident.</div>';
            }
        } catch (err) {
            console.error(err);
            container.innerHTML = '<div class="text-center text-statusCritical text-xs font-bold py-2">Failed to load requests.</div>';
        }
    };

    const btnClearQueue = document.getElementById('btn-clear-queue');
    if (btnClearQueue) {
        btnClearQueue.addEventListener('click', async () => {
            // First return ALL dispatched trucks
            for (const crisis of queueManager.crises) {
                if (crisis.status === 'MONITORING') {
                    try {
                        await fetch(`http://localhost:5000/api/v1/dispatch/return/${crisis._id}`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${MOCK_HQ_TOKEN}` }
                        });
                    } catch(e) {}
                }
            }

            // Optimistically remove all trucks from map immediately
            fleetManager.clearAllTrucks();
            
            try {
                const response = await fetch(`http://localhost:5000/api/v1/crises`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${MOCK_HQ_TOKEN}` }
                });
                if (response.ok) {
                    queueManager.fetchAndRender();
                }
            } catch(e) { console.error(e); }
        });
    }

    btnRandom.addEventListener('click', async () => {
        const lat = 12.8 + Math.random() * 0.3;
        const lng = 77.5 + Math.random() * 0.2;
        const severities = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
        const types = ['Fire Emergency', 'Flash Flood', 'Medical Crisis', 'Structural Collapse', 'Power Outage'];
        const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        const locationName = await getAddressFromCoords(lat, lng);
        
        postCrisis({
            name: `${type} at ${locationName}`,
            description: "Auto-generated emergency via Simulator.",
            severity: randomSeverity,
            epicenter: { type: "Point", coordinates: [lng, lat] },
            radiusKm: 5,
            estimatedAffected: Math.floor(Math.random() * 5000) + 100
        });
    });

    // Auto-Spawner Logic
    const toggleAutoSpawner = document.getElementById('toggle-auto-spawner');
    let spawnerTimeout = null;

    const spawnRandomCrisis = async () => {
        const lat = 12.8 + Math.random() * 0.3;
        const lng = 77.5 + Math.random() * 0.2;
        const severities = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
        const types = ['Fire Emergency', 'Flash Flood', 'Medical Crisis', 'Structural Collapse', 'Power Outage'];
        const locationName = await getAddressFromCoords(lat, lng);
        
        postCrisis({
            name: `${types[Math.floor(Math.random() * types.length)]} at ${locationName}`,
            description: "Auto-generated live simulation event.",
            severity: severities[Math.floor(Math.random() * severities.length)],
            epicenter: { type: "Point", coordinates: [lng, lat] },
            radiusKm: Math.floor(Math.random() * 10) + 1,
            estimatedAffected: Math.floor(Math.random() * 5000) + 100
        });

        // Schedule next spawn between 20 and 40 seconds if toggle is still checked
        if (toggleAutoSpawner && toggleAutoSpawner.checked) {
            const nextDelay = Math.floor(Math.random() * (40000 - 20000 + 1)) + 20000;
            spawnerTimeout = setTimeout(spawnRandomCrisis, nextDelay);
        }
    };

    if (toggleAutoSpawner) {
        toggleAutoSpawner.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Start spawner immediately, then it will loop itself
                spawnRandomCrisis();
            } else {
                if (spawnerTimeout) clearTimeout(spawnerTimeout);
                spawnerTimeout = null;
            }
        });
    }

    mapManager.map.on('click', (e) => {
        if (document.getElementById('view-simulator').classList.contains('hidden')) return;
        currentClickCoords = e.latlng;
        modalCoords.innerText = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
        modal.classList.remove('hidden');
    });

    const closeMapModalIfNeeded = () => {
        if (mapSection && mapSection.classList.contains('map-modal-mode')) {
            mapSection.classList.remove('map-modal-mode');
            if (document.getElementById('view-simulator') && !document.getElementById('view-simulator').classList.contains('hidden')) {
                mapSection.classList.add('hidden');
            }
            setTimeout(() => {
                if (mapManager.map) mapManager.map.invalidateSize();
            }, 100);
        }
    };

    modalCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
        currentClickCoords = null;
        closeMapModalIfNeeded();
    });

    modalConfirm.addEventListener('click', async () => {
        if (!currentClickCoords) return;
        
        const type = modalTitle.value || "Emergency";
        const locationName = await getAddressFromCoords(currentClickCoords.lat, currentClickCoords.lng);
        const finalName = `${type} at ${locationName}`;
        
        postCrisis({
            name: finalName,
            description: "Manually declared hotzone via map click.",
            severity: modalSeverity.value || "HIGH",
            epicenter: { type: "Point", coordinates: [currentClickCoords.lng, currentClickCoords.lat] },
            radiusKm: 2,
            estimatedAffected: 1000
        });
        modal.classList.add('hidden');
        currentClickCoords = null;
        closeMapModalIfNeeded();
    });

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    if (speedSlider) {
        const initialVal = parseFloat(speedSlider.value) / 10;
        fleetManager.setSpeed(initialVal);
        
        // Ensure server gets the initial speed immediately upon connection
        if (socketManager && socketManager.socket) {
            if (socketManager.socket.connected) {
                socketManager.socket.emit('admin:speed_update', initialVal);
            } else {
                socketManager.socket.on('connect', () => {
                    socketManager.socket.emit('admin:speed_update', initialVal);
                });
            }
        }

        speedSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) / 10;
            fleetManager.setSpeed(val);
            socketManager.socket.emit('admin:speed_update', val);
            speedValue.textContent = `${val.toFixed(1)}x`;
        });
    }
}

// Staggered Animation Observer
function initAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-up-element').forEach(el => {
        observer.observe(el);
    });
}

// Initialize the application
async function bootstrap() {
    console.log('Bootstrapping DropZone Admin Dashboard...');
    
    // Initialize Theme
    initTheme();
    
    // Initialize Map & Animations
    await initMap();
    initAnimations();
    initTabs();
    initSimulator();
    
    // Connect Real-time Socket
    socketManager.connect(MOCK_HQ_TOKEN);
    
    // Initial Fetch
    await queueManager.fetchAndRender();
    
    // Set an interval to refresh the 'Time Waiting' every second
    setInterval(() => {
        queueManager.fetchAndRender();
    }, 60000); 
}

bootstrap();
