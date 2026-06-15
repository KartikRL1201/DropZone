document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMap();
    fetchCrises();
    setInterval(fetchCrises, 10000); // Auto-poll every 10 seconds
    loadWarehouses();
    setupItemList();
    setupForm();
});

function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
    }
    
    toggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            localStorage.setItem('theme', 'light');
            if (map) {
                map.removeLayer(currentTiles);
                currentTiles = lightTiles;
                currentTiles.addTo(map);
            }
        } else {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
            localStorage.setItem('theme', 'dark');
            if (map) {
                map.removeLayer(currentTiles);
                currentTiles = darkTiles;
                currentTiles.addTo(map);
            }
        }
    });
}

let map;
let marker;
let lightTiles;
let darkTiles;
let currentTiles;
let landmarks = [];
let warehouseLayers = [];
let activeCrises = [];
let crisisLayers = [];

async function loadWarehouses() {
    try {
        const res = await fetch('/api/v1/warehouses', {
            headers: { 'Authorization': 'Bearer mock-hq-token-123' }
        });
        const result = await res.json();
        if (result.success) {
            landmarks = result.data;
            renderLandmarks();
        }
    } catch (error) {
        console.error('Failed to load warehouses:', error);
    }
}

function renderLandmarks() {
    if (!map) return;
    
    warehouseLayers.forEach(layer => map.removeLayer(layer));
    warehouseLayers = [];

    landmarks.forEach(lm => {
        const isHq = lm.code === 'hq';
        let colorClass = isHq ? 'bg-lumenaDark text-lumenaLight dark:bg-lumenaLight dark:text-lumenaDark border-white shadow-xl' : 'bg-blue-600 text-white border-blue-300 shadow-md';
        let size = isHq ? 'w-10 h-10 text-[20px]' : 'w-8 h-8 text-[16px]';
        let zIndex = isHq ? 500 : 400;
        let iconHtml = `
            <div class="flex items-center justify-center rounded-full border-[2px] ${colorClass} ${size} transition-transform hover:scale-110">
                <span class="material-symbols-outlined" style="font-size: inherit">${isHq ? 'warehouse' : 'inventory_2'}</span>
            </div>
        `;
        const dim = isHq ? 40 : 32;
        const icon = L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [dim, dim], iconAnchor: [dim/2, dim/2] });
        
        const lng = lm.location.coordinates[0];
        const lat = lm.location.coordinates[1];
        
        const marker = L.marker([lat, lng], {icon: icon, zIndexOffset: zIndex}).addTo(map);
        marker.bindTooltip(lm.name, { direction: 'top', offset: [0, -(dim/2 - 5)], className: 'font-sans font-bold text-[10px] tracking-widest' });
        warehouseLayers.push(marker);
    });
}

function renderCrises() {
    if (!map) return;
    
    crisisLayers.forEach(layer => map.removeLayer(layer));
    crisisLayers = [];

    activeCrises.forEach(crisis => {
        const isCritical = crisis.severity === 'CRITICAL';
        const colorClass = isCritical ? 'bg-red-600 border-red-300 shadow-red-500/50' : 'bg-orange-500 border-orange-300 shadow-orange-500/50';
        
        let iconHtml = `
            <div class="flex items-center justify-center rounded-full border-[2px] ${colorClass} text-white w-8 h-8 transition-transform hover:scale-110 shadow-lg animate-pulse">
                <span class="material-symbols-outlined text-[16px]">emergency</span>
            </div>
        `;
        const icon = L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [32, 32], iconAnchor: [16, 16] });
        
        const lng = crisis.epicenter.coordinates[0];
        const lat = crisis.epicenter.coordinates[1];
        
        const marker = L.marker([lat, lng], {icon: icon, zIndexOffset: 300}).addTo(map);
        marker.bindTooltip(crisis.name, { direction: 'top', offset: [0, -15], className: 'font-sans font-bold text-[10px] tracking-widest uppercase' });
        crisisLayers.push(marker);
    });
}

function initMap() {
    const bengaluruBounds = L.latLngBounds(
        [12.6, 77.3], // Expanded South-West corner
        [13.3, 77.9]  // Expanded North-East corner
    );

    map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        minZoom: 11,
        maxBounds: bengaluruBounds,
        maxBoundsViscosity: 1.0
    }).setView([12.9716, 77.5946], 12);

    lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, noWrap: true, bounds: bengaluruBounds
    });
    darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, noWrap: true, bounds: bengaluruBounds
    });

    const isDark = document.documentElement.classList.contains('dark');
    currentTiles = isDark ? darkTiles : lightTiles;
    currentTiles.addTo(map);

    map.on('click', (e) => {
        setMarker(e.latlng.lat, e.latlng.lng);
    });

    document.getElementById('btn-locate').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    map.setView([lat, lng], 15);
                    setMarker(lat, lng);
                },
                (err) => {
                    alert('Could not get your location automatically. Please tap on the map.');
                }
            );
        }
    });
}

function setMarker(lat, lng) {
    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng]).addTo(map);
    }
    document.getElementById('lat').value = lat;
    document.getElementById('lng').value = lng;
}

async function fetchCrises() {
    try {
        const response = await fetch('/api/v1/crises');
        const result = await response.json();
        
        const select = document.getElementById('crisis-id');
        const currentValue = select.value;
        
        select.innerHTML = '<option class="bg-white dark:bg-gray-800 text-black dark:text-white" value="" disabled selected>Select an incident...</option>';
        
        if (result.success && result.data.length > 0) {
            activeCrises = result.data;
            renderCrises();
            
            result.data.forEach(crisis => {
                const shortId = crisis._id.substring(crisis._id.length - 4).toUpperCase();
                const option = document.createElement('option');
                option.value = crisis._id;
                option.textContent = `${crisis.name} (ID: ${shortId}) - ${crisis.severity} Priority`;
                select.appendChild(option);
            });
            // Restore previous selection so UI doesn't reset while citizen is typing
            if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
                select.value = currentValue;
            }
        } else {
            activeCrises = [];
            renderCrises();
            select.innerHTML = '<option class="bg-white dark:bg-gray-800 text-black dark:text-white" value="" disabled selected>No active crises found.</option>';
        }
    } catch (err) {
        console.error('Failed to fetch crises:', err);
    }
}

function setupItemList() {
    const btnAdd = document.getElementById('btn-add-item');
    const itemsList = document.getElementById('items-list');

    btnAdd.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'item-row flex gap-2 items-start fade-up-element';
        row.style.animationDuration = '0.3s';
        row.style.transform = 'translateY(0)';
        row.style.opacity = '1';
        
        row.innerHTML = `
            <select class="item-category w-1/3 bg-lumenaDark/5 dark:bg-lumenaLight/5 border-none rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-lumenaDark dark:focus:ring-lumenaLight outline-none appearance-none cursor-pointer">
                <option class="bg-white dark:bg-gray-800 text-black dark:text-white" value="MEDICAL">Medical</option>
                <option class="bg-white dark:bg-gray-800 text-black dark:text-white" value="WATER">Water</option>
                <option class="bg-white dark:bg-gray-800 text-black dark:text-white" value="FOOD">Food</option>
                <option class="bg-white dark:bg-gray-800 text-black dark:text-white" value="BLANKETS">Blankets</option>
            </select>
            <input type="number" class="item-quantity w-1/4 bg-lumenaDark/5 dark:bg-lumenaLight/5 border-none rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-lumenaDark dark:focus:ring-lumenaLight outline-none" placeholder="Qty" min="1" required>
            <input type="text" class="item-desc w-full bg-lumenaDark/5 dark:bg-lumenaLight/5 border-none rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-lumenaDark dark:focus:ring-lumenaLight outline-none" placeholder="Details" required>
            <button type="button" class="btn-remove-item p-2 opacity-40 hover:opacity-100 hover:text-statusCritical transition-all mt-0.5">
                <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
        `;
        
        itemsList.appendChild(row);
        updateRemoveButtons();
    });

    itemsList.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-item');
        if (btn && document.querySelectorAll('.item-row').length > 1) {
            btn.closest('.item-row').remove();
            updateRemoveButtons();
        }
    });
}

function updateRemoveButtons() {
    const rows = document.querySelectorAll('.item-row');
    const btns = document.querySelectorAll('.btn-remove-item');
    if (rows.length <= 1) {
        btns.forEach(b => b.disabled = true);
    } else {
        btns.forEach(b => b.disabled = false);
    }
}

function setupForm() {
    const form = document.getElementById('volunteer-form');
    const errorEl = document.getElementById('form-error');
    const successState = document.getElementById('success-state');
    const btnSubmit = document.getElementById('btn-submit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.classList.add('hidden');
        
        const lat = document.getElementById('lat').value;
        const lng = document.getElementById('lng').value;
        
        if (!lat || !lng) {
            errorEl.textContent = 'Please tap on the map to set a drop location.';
            errorEl.classList.remove('hidden');
            return;
        }

        const items = [];
        document.querySelectorAll('.item-row').forEach(row => {
            items.push({
                category: row.querySelector('.item-category').value,
                quantityNeeded: parseInt(row.querySelector('.item-quantity').value, 10),
                description: row.querySelector('.item-desc').value
            });
        });

        // Use crypto.randomUUID() supported in modern browsers
        const idempotencyKey = crypto.randomUUID();

        const payload = {
            crisisId: document.getElementById('crisis-id').value,
            requesterName: document.getElementById('requester-name').value,
            contactPhone: document.getElementById('contact-phone').value,
            contactEmail: document.getElementById('contact-email').value || undefined,
            location: {
                type: 'Point',
                coordinates: [parseFloat(lng), parseFloat(lat)] // GeoJSON uses [lng, lat]
            },
            locationAddress: document.getElementById('location-address').value,
            urgency: document.getElementById('urgency').value,
            peopleCount: parseInt(document.getElementById('people-count').value, 10),
            notes: document.getElementById('notes').value || undefined,
            items: items,
            idempotencyKey: idempotencyKey
        };

        try {
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.5';
            
            const response = await fetch('/api/v1/requests/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                form.classList.add('hidden');
                successState.classList.remove('hidden');
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                let errorMessage = result.error || 'Failed to submit request';
                if (result.issues && result.issues.length > 0) {
                    errorMessage += ': ' + result.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
        }
    });

    document.getElementById('btn-new-request').addEventListener('click', () => {
        form.reset();
        document.getElementById('lat').value = '';
        document.getElementById('lng').value = '';
        if (marker) {
            map.removeLayer(marker);
            marker = null;
        }
        successState.classList.add('hidden');
        form.classList.remove('hidden');
        
        // Reset items to just 1
        const itemsList = document.getElementById('items-list');
        const rows = itemsList.querySelectorAll('.item-row');
        for (let i = 1; i < rows.length; i++) {
            rows[i].remove();
        }
        updateRemoveButtons();
    });
}
