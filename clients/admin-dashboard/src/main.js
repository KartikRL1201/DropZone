import { socketManager } from './socketManager.js';
import { queueManager } from './queue.js';
import { mapManager } from './mapManager.js';
import { fleetManager } from './fleetManager.js';

// Connection UI Elements
const indicator = document.getElementById('connection-indicator');
const indicatorText = document.getElementById('connection-text');

// Auth Token (Mocking for now, eventually grab from login)
// In a real app we'd fetch this from localStorage after auth
const MOCK_HQ_TOKEN = 'mock-hq-token-123';

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
function initMap() {
    mapManager.init();
    fleetManager.startSimulation();
}

function initTabs() {
    const tabQueue = document.getElementById('tab-queue');
    const tabSimulator = document.getElementById('tab-simulator');
    const viewQueue = document.getElementById('view-queue');
    const viewSimulator = document.getElementById('view-simulator');
    const queueSearch = document.getElementById('queue-search');

    if(!tabQueue) return;

    tabQueue.addEventListener('click', () => {
        tabQueue.classList.remove('border-transparent', 'opacity-40');
        tabQueue.classList.add('border-lumenaDark', 'dark:border-lumenaLight');
        tabSimulator.classList.add('border-transparent', 'opacity-40');
        tabSimulator.classList.remove('border-lumenaDark', 'dark:border-lumenaLight');
        
        viewQueue.classList.remove('hidden');
        viewSimulator.classList.add('hidden');
        if(queueSearch) queueSearch.classList.remove('hidden');
    });

    tabSimulator.addEventListener('click', () => {
        tabSimulator.classList.remove('border-transparent', 'opacity-40');
        tabSimulator.classList.add('border-lumenaDark', 'dark:border-lumenaLight');
        tabQueue.classList.add('border-transparent', 'opacity-40');
        tabQueue.classList.remove('border-lumenaDark', 'dark:border-lumenaLight');
        
        viewSimulator.classList.remove('hidden');
        viewQueue.classList.add('hidden');
        if(queueSearch) queueSearch.classList.add('hidden');
    });
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

    let currentClickCoords = null;

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

        // Optimistic UI: immediately mark as deployed so button disables instantly
        crisis.status = 'MONITORING';
        queueManager.render(queueManager.crises);

        // Dispatch truck on map
        fleetManager.dispatchTruck(crisis);

        // Update DB status to MONITORING in the background
        try {
            await fetch(`http://localhost:5000/api/v1/crises/${id}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MOCK_HQ_TOKEN}` 
                },
                body: JSON.stringify({ status: 'MONITORING' })
            });
        } catch(e) { console.error(e); }
    };

    window.deleteCrisis = async (id) => {
        // Optimistically remove truck from map immediately
        fleetManager.removeTruckForCrisis(id);
        
        try {
            const response = await fetch(`http://localhost:5000/api/v1/crises/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${MOCK_HQ_TOKEN}` }
            });
            if (response.ok) {
                queueManager.fetchAndRender();
            }
        } catch(e) { console.error(e); }
    };

    const btnClearQueue = document.getElementById('btn-clear-queue');
    if (btnClearQueue) {
        btnClearQueue.addEventListener('click', async () => {
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

    btnRandom.addEventListener('click', () => {
        const lat = 12.8 + Math.random() * 0.3;
        const lng = 77.5 + Math.random() * 0.2;
        const severities = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
        const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
        
        postCrisis({
            name: "Simulated Random Crisis",
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

    const spawnRandomCrisis = () => {
        const lat = 12.8 + Math.random() * 0.3;
        const lng = 77.5 + Math.random() * 0.2;
        const severities = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
        const types = ['Fire Emergency', 'Flash Flood', 'Medical Crisis', 'Structural Collapse', 'Power Outage'];
        
        postCrisis({
            name: types[Math.floor(Math.random() * types.length)],
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

    modalCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
        currentClickCoords = null;
    });

    modalConfirm.addEventListener('click', () => {
        if (!currentClickCoords) return;
        postCrisis({
            name: modalTitle.value || "Custom Crisis Zone",
            description: "Manually declared hotzone via map click.",
            severity: modalSeverity.value || "HIGH",
            epicenter: { type: "Point", coordinates: [currentClickCoords.lng, currentClickCoords.lat] },
            radiusKm: 2,
            estimatedAffected: 1000
        });
        modal.classList.add('hidden');
        currentClickCoords = null;
    });

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    if (speedSlider) {
        const initialVal = parseFloat(speedSlider.value) / 10;
        fleetManager.setSpeed(initialVal);
        
        speedSlider.addEventListener('input', () => {
            const val = parseFloat(speedSlider.value) / 10;
            fleetManager.setSpeed(val);
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
    initMap();
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
