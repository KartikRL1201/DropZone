import { socketManager } from './socketManager.js';
import { mapManager } from './mapManager.js';
import { fleetManager } from './fleetManager.js';

class QueueManager {
    constructor() {
        this.tbody = document.getElementById('requests-queue-body');
        this.statQueued = document.getElementById('stat-queued');
        this.crises = [];
        this.searchTerm = '';
        
        const searchInput = document.getElementById('queue-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase().trim();
                if (this.crises) this.render(this.crises);
            });
        }
    }

    async fetchAndRender() {
        if (!this.tbody) return;
        
        try {
            const response = await fetch('http://localhost:5000/api/v1/crises');
            
            if (response.ok) {
                const data = await response.json();
                const crises = data.data || [];
                this.crises = crises;
                this.render(crises);
            } else {
                console.error("Backend returned an error");
                this.render([]);
            }
        } catch (error) {
            console.error('Failed to fetch queue data:', error);
            this.tbody.innerHTML = '<div class="p-8 text-center opacity-40 font-medium">Cannot connect to backend database.</div>';
            mapManager.renderMarkers([]);
        }
    }

    render(crises) {
        this.tbody.innerHTML = '';
        
        if (!crises || crises.length === 0) {
            this.tbody.innerHTML = '<div class="p-8 text-center opacity-40 font-medium">No active requests in queue.</div>';
            mapManager.renderMarkers([]);
            return;
        }

        // Update map markers and sync active trucks
        mapManager.renderMarkers(crises);
        fleetManager.syncWithQueue(crises);

        // Update total queued stat
        if (this.statQueued) {
            const total = crises.reduce((sum, c) => sum + (c.estimatedAffected || 0), 0);
            this.statQueued.innerHTML = `${total.toLocaleString()}<span class="text-sm font-medium tracking-normal opacity-40"> POP</span>`;
        }

        let displayCrises = crises;
        if (this.searchTerm) {
            displayCrises = crises.filter(c => {
                const idString = c._id.substring(c._id.length - 4).toLowerCase();
                const nameString = (c.name || '').toLowerCase();
                return idString.includes(this.searchTerm) || nameString.includes(this.searchTerm);
            });
        }

        if (displayCrises.length === 0) {
            this.tbody.innerHTML = '<div class="p-8 text-center opacity-40 font-medium">No active requests matching search.</div>';
            return;
        }

        displayCrises.forEach((crisis, index) => {
            const row = document.createElement('div');
            row.className = `grid grid-cols-12 gap-4 items-center p-4 border-b editorial-border grid-row-hover`;
            
            const timeWaiting = this._calculateWaitTime(crisis.createdAt);
            
            let urgencyColorClass = '';
            let urgencyText = crisis.severity || 'LOW';
            
            if (crisis.severity === 'CRITICAL') {
                urgencyColorClass = 'text-statusCritical';
            } else if (crisis.severity === 'HIGH') {
                urgencyColorClass = 'text-statusHigh';
            } else if (crisis.severity === 'MODERATE') {
                urgencyColorClass = 'text-statusMedium';
            } else {
                urgencyColorClass = 'text-statusLow';
            }

            row.innerHTML = `
                <div class="col-span-2 flex flex-col">
                    <span class="font-bold text-sm tracking-tight">REQ-${crisis._id.substring(crisis._id.length - 4).toUpperCase()}</span>
                    <span class="${urgencyColorClass} text-[9px] font-bold tracking-widest uppercase mt-1 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-current"></span> ${urgencyText}
                    </span>
                </div>
                
                <div class="col-span-3 flex flex-col">
                    <span class="font-bold text-sm truncate">${crisis.name || 'Crisis Zone'}</span>
                    <span class="text-[9px] font-bold tracking-widest uppercase opacity-40 mt-1 truncate">Pop: ${crisis.estimatedAffected || 0}</span>
                </div>
                
                <div class="col-span-5 flex flex-wrap gap-2 items-center">
                    <span class="bg-lumenaDark/5 dark:bg-lumenaLight/5 px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase">LOC: ${crisis.epicenter?.coordinates?.[1]?.toFixed(4)}, ${crisis.epicenter?.coordinates?.[0]?.toFixed(4)}</span>
                    <span class="bg-lumenaDark/5 dark:bg-lumenaLight/5 px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase">R: ${crisis.radiusKm || 0}km</span>
                </div>
                
                <div class="col-span-2 text-right flex flex-col items-end justify-center gap-1">
                    <div class="flex items-center gap-2 mt-1">
                        ${crisis.status === 'MONITORING' 
                            ? `<button disabled class="opacity-50 cursor-not-allowed text-[9px] font-bold tracking-widest uppercase text-gray-400 border border-gray-500/30 bg-gray-500/10 rounded-full px-3 py-1">Deployed</button>`
                            : `<button onclick="window.deployFleet('${crisis._id}')" class="text-[9px] font-bold tracking-widest uppercase text-lumenaLight bg-lumenaDark dark:bg-lumenaLight dark:text-lumenaDark hover:opacity-80 transition-opacity rounded-full px-3 py-1">Deploy</button>`
                        }
                        <button onclick="window.deleteCrisis('${crisis._id}')" class="text-statusCritical opacity-40 hover:opacity-100 transition-opacity"><span class="material-symbols-outlined text-[14px]">delete</span></button>
                    </div>
                </div>
            `;
            
            this.tbody.appendChild(row);
        });
    }

    _calculateWaitTime(createdAt) {
        if (!createdAt) return '00:00';
        const diffMs = Date.now() - new Date(createdAt).getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(diffSecs / 60).toString().padStart(2, '0');
        const secs = (diffSecs % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }
}

export const queueManager = new QueueManager();
