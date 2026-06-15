import { socketManager } from './socketManager.js';
import { mapManager } from './mapManager.js';

class InventoryManager {
    constructor() {
        this.container = document.getElementById('inventory-grid');
        this.airdropTimers = {};
        this.airdropIntervals = {};

        // Restore any active cooldowns from localStorage
        this._restoreCooldowns();
        
        socketManager.on('warehouse:updated', (warehouse) => {
            // Update map
            const index = mapManager.landmarks.findIndex(lm => String(lm._id) === String(warehouse._id));
            if (index !== -1) {
                mapManager.landmarks[index] = warehouse;
                mapManager.renderLandmarks();
            }
            
            // Re-render inventory grid
            this.render();
        });
    }

    _restoreCooldowns() {
        try {
            const saved = JSON.parse(localStorage.getItem('airdropCooldowns') || '{}');
            const now = Date.now();
            for (const [warehouseId, endTime] of Object.entries(saved)) {
                const remaining = Math.ceil((endTime - now) / 1000);
                if (remaining > 0) {
                    this.airdropTimers[warehouseId] = remaining;
                    this._startCountdown(warehouseId);
                } else {
                    // Expired, clean it up
                    delete saved[warehouseId];
                }
            }
            localStorage.setItem('airdropCooldowns', JSON.stringify(saved));
        } catch (e) {
            console.error('Error restoring airdrop cooldowns', e);
        }
    }

    _saveCooldown(warehouseId, seconds) {
        try {
            const saved = JSON.parse(localStorage.getItem('airdropCooldowns') || '{}');
            saved[warehouseId] = Date.now() + (seconds * 1000);
            localStorage.setItem('airdropCooldowns', JSON.stringify(saved));
        } catch (e) {
            console.error('Error saving airdrop cooldown', e);
        }
    }

    _clearCooldown(warehouseId) {
        try {
            const saved = JSON.parse(localStorage.getItem('airdropCooldowns') || '{}');
            delete saved[warehouseId];
            localStorage.setItem('airdropCooldowns', JSON.stringify(saved));
        } catch (e) {
            console.error('Error clearing airdrop cooldown', e);
        }
    }

    _startCountdown(warehouseId) {
        if (this.airdropIntervals[warehouseId]) clearInterval(this.airdropIntervals[warehouseId]);

        this.airdropIntervals[warehouseId] = setInterval(() => {
            if (this.airdropTimers[warehouseId] > 0) {
                this.airdropTimers[warehouseId]--;
                this.render();
            }
            if (this.airdropTimers[warehouseId] <= 0) {
                clearInterval(this.airdropIntervals[warehouseId]);
                delete this.airdropIntervals[warehouseId];
                delete this.airdropTimers[warehouseId];
                this._clearCooldown(warehouseId);
                this.render();
            }
        }, 1000);
    }

    async requestAirdrop(warehouseId) {
        if (this.airdropTimers[warehouseId]) return;

        try {
            const token = window.MOCK_HQ_TOKEN;
            const res = await fetch(`http://localhost:5000/api/v1/warehouses/${warehouseId}/resupply`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                const cooldownSeconds = data.estimatedArrivalSeconds || 60;
                this.airdropTimers[warehouseId] = cooldownSeconds;
                this._saveCooldown(warehouseId, cooldownSeconds);
                this._startCountdown(warehouseId);
                this.render();
            } else {
                alert(data.error || 'Failed to request airdrop');
            }
        } catch (e) {
            console.error(e);
            alert('Network error requesting airdrop.');
        }
    }

    render() {
        if (!this.container) return;
        
        const warehouses = mapManager.landmarks || [];
        this.container.innerHTML = '';

        warehouses.forEach(wh => {
            const card = document.createElement('div');
            card.className = 'bg-lumenaDark/5 dark:bg-lumenaLight/5 border editorial-border p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden';
            
            // Truck Status
            const truckPercentage = (wh.trucks.available / wh.trucks.total) * 100;
            const truckColor = truckPercentage < 20 ? 'text-statusCritical' : (truckPercentage < 50 ? 'text-statusMedium' : 'text-statusHigh');
            
            // Generate Supply Bars
            let suppliesHtml = '';
            wh.inventory.forEach(item => {
                // Determine a max cap for percentage. We'll use 500 for equipment, 5000 for water, etc.
                // Just use a generic logic since we randomized them. Let's assume max is whatever it currently is + 1000, 
                // but actually let's hardcode some maxes for progress bar aesthetics.
                let max = 1000;
                if (item.category === 'WATER') max = 5000;
                if (item.category === 'MEDICAL') max = 2000;
                if (item.category === 'FOOD') max = 3000;
                if (item.category === 'BLANKETS') max = 1000;
                if (item.category === 'EQUIPMENT') max = 500;
                
                const pct = Math.min(100, Math.max(0, (item.quantity / max) * 100));
                const barColor = pct < 20 ? 'bg-statusCritical' : (pct < 50 ? 'bg-statusMedium' : 'bg-statusHigh');
                const textColor = pct < 20 ? 'text-statusCritical' : (pct < 50 ? 'text-statusMedium' : 'text-statusHigh');
                
                suppliesHtml += `
                    <div>
                        <div class="flex justify-between text-[10px] font-bold tracking-widest uppercase mb-1">
                            <span class="opacity-60">${item.category}</span>
                            <span class="${textColor}">${item.quantity}</span>
                        </div>
                        <div class="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full ${barColor} transition-all duration-1000" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            });

            const timer = this.airdropTimers[wh._id];
            const timerMins = timer ? Math.floor(timer / 60).toString().padStart(2, '0') : '00';
            const timerSecs = timer ? (timer % 60).toString().padStart(2, '0') : '00';
            const btnContent = timer ? `INCOMING — ${timerMins}:${timerSecs}` : 'Request Airdrop';
            const btnClass = timer 
                ? 'opacity-50 cursor-not-allowed bg-statusHigh/20 border-statusHigh text-statusHigh' 
                : 'hover:bg-black/5 dark:hover:bg-white/5 border-black/10 dark:border-white/10';

            card.innerHTML = `
                <div class="flex justify-between items-start mb-2 border-b border-black/10 dark:border-white/10 pb-4">
                    <div>
                        <h3 class="font-bold text-lg leading-tight uppercase tracking-widest">${wh.name}</h3>
                        <p class="text-[10px] font-bold uppercase opacity-40 tracking-widest">CODE: ${wh.code}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-bold ${truckColor}">${wh.trucks.available}</span>
                        <span class="text-[10px] font-bold uppercase opacity-40">/${wh.trucks.total} Fleet</span>
                    </div>
                </div>
                <div class="flex flex-col gap-3 mb-4">
                    ${suppliesHtml}
                </div>
                <button ${timer ? 'disabled' : ''} class="mt-auto px-4 py-3 border rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors btn-airdrop ${btnClass}">
                    ${btnContent}
                </button>
            `;

            // Bind airdrop button
            card.querySelector('.btn-airdrop').addEventListener('click', () => {
                this.requestAirdrop(wh._id);
            });

            this.container.appendChild(card);
        });
    }
}

export const inventoryManager = new InventoryManager();
