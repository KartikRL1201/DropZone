import { authManager } from './authManager.js';
import { fleetManager } from './fleetManager.js';

export const teamManager = {
    warehouses: [],
    
    async fetchWarehouses() {
        try {
            const res = await authManager.secureFetch('http://localhost:5000/api/v1/warehouses');
            const data = await res.json();
            if (res.ok && data.success) {
                this.warehouses = data.data;
                this.populateWarehouseDropdowns();
            }
        } catch (e) {
            console.error('Failed to fetch warehouses for team manager', e);
        }
    },

    populateWarehouseDropdowns() {
        const teamSelect = document.getElementById('team-warehouse');
        const editSelect = document.getElementById('edit-user-warehouse');
        if (!teamSelect || !editSelect) return;

        let html = '<option value="" disabled selected>Select a Warehouse</option>';
        this.warehouses.forEach(wh => {
            html += `<option value="${wh._id}">${wh.name} (${wh.code})</option>`;
        });
        teamSelect.innerHTML = html;
        editSelect.innerHTML = html;
    },

    async fetchAndRender() {
        const adminBody = document.getElementById('admin-roster-body');
        const driverBody = document.getElementById('driver-roster-body');
        if (!adminBody || !driverBody) return;

        try {
            const res = await authManager.secureFetch('http://localhost:5000/api/v1/users');
            const data = await res.json();
            
            if (res.ok && data.success) {
                this.render(data.data);
            } else {
                adminBody.innerHTML = `<div class="text-center text-statusCritical text-xs font-bold py-4">${data.error || 'Failed to load team'}</div>`;
                driverBody.innerHTML = '';
            }
        } catch (e) {
            console.error(e);
            adminBody.innerHTML = `<div class="text-center text-statusCritical text-xs font-bold py-4">Error connecting to server</div>`;
            driverBody.innerHTML = '';
        }
    },

    render(users) {
        const adminBody = document.getElementById('admin-roster-body');
        const driverBody = document.getElementById('driver-roster-body');
        if (!adminBody || !driverBody) return;

        const admins = users.filter(u => u.role === 'ADMIN');
        const drivers = users.filter(u => u.role === 'DRIVER');

        if (admins.length === 0) {
            adminBody.innerHTML = '<div class="text-center opacity-40 text-xs font-bold py-4">No admins found.</div>';
        } else {
            let adminHtml = '';
            admins.forEach(user => {
                adminHtml += `
                    <div class="grid grid-cols-12 gap-2 px-2 py-3 bg-white/5 dark:bg-black/20 border border-krypton-border rounded items-center hover:bg-white/10 dark:hover:bg-white/5 transition-colors">
                        <div class="col-span-5 flex flex-col">
                            <span class="font-bold text-xs">${user.name}</span>
                            <span class="text-[9px] opacity-60">${user.email}</span>
                        </div>
                        <div class="col-span-4 flex items-center">
                            <span class="text-xs opacity-80">${user.phone}</span>
                        </div>
                        <div class="col-span-3 text-right flex justify-end gap-2">
                            <button onclick="window.editTeamMember('${user._id}', '${user.role}', '${user.name}', '${user.phone}', null)" class="text-accent-blue hover:text-white hover:bg-accent-blue px-2 py-1 border border-accent-blue/30 rounded text-[9px] font-bold tracking-widest uppercase transition-colors">Edit</button>
                            <button onclick="window.deleteTeamMember('${user._id}')" class="text-accent-red hover:text-white hover:bg-accent-red px-2 py-1 border border-accent-red/30 rounded text-[9px] font-bold tracking-widest uppercase transition-colors">Remove</button>
                        </div>
                    </div>
                `;
            });
            adminBody.innerHTML = adminHtml;
        }

        if (drivers.length === 0) {
            driverBody.innerHTML = '<div class="text-center opacity-40 text-xs font-bold py-4">No drivers found.</div>';
        } else {
            let driverHtml = '';
            drivers.forEach(user => {
                const whName = user.assignedWarehouse ? user.assignedWarehouse.name : 'Unassigned';
                const whId = user.assignedWarehouse ? user.assignedWarehouse._id : null;
                driverHtml += `
                    <div class="grid grid-cols-12 gap-2 px-2 py-3 bg-white/5 dark:bg-black/20 border border-krypton-border rounded items-center hover:bg-white/10 dark:hover:bg-white/5 transition-colors">
                        <div class="col-span-3 flex flex-col">
                            <span class="font-bold text-xs">${user.name}</span>
                            <span class="text-[9px] opacity-60">${user.email}</span>
                        </div>
                        <div class="col-span-3 flex items-center">
                            <span class="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border text-accent-orange bg-accent-orange/10 border-accent-orange/20 truncate" title="${whName}">${whName}</span>
                        </div>
                        <div class="col-span-4 flex items-center">
                            <span class="text-xs opacity-80">${user.phone}</span>
                        </div>
                        <div class="col-span-2 text-right flex justify-end gap-2">
                            ${fleetManager.vehicles && fleetManager.vehicles.has(user._id) 
                                ? `<button disabled title="Cannot modify an active driver currently on a mission" class="text-gray-500 opacity-50 cursor-not-allowed px-2 py-1 border border-gray-500/30 rounded text-[9px] font-bold tracking-widest uppercase transition-colors">Edit</button>
                                   <button disabled title="Cannot remove an active driver currently on a mission" class="text-gray-500 opacity-50 cursor-not-allowed px-2 py-1 border border-gray-500/30 rounded text-[9px] font-bold tracking-widest uppercase transition-colors">Remove</button>`
                                : `<button onclick="window.editTeamMember('${user._id}', '${user.role}', '${user.name}', '${user.phone}', '${whId}')" class="text-accent-blue hover:text-white hover:bg-accent-blue px-2 py-1 border border-accent-blue/30 rounded text-[9px] font-bold tracking-widest uppercase transition-colors">Edit</button>
                                   <button onclick="window.deleteTeamMember('${user._id}')" class="text-accent-red hover:text-white hover:bg-accent-red px-2 py-1 border border-accent-red/30 rounded text-[9px] font-bold tracking-widest uppercase transition-colors">Remove</button>`
                            }
                        </div>
                    </div>
                `;
            });
            driverBody.innerHTML = driverHtml;
        }
    },

    async createUser(payload) {
        const btnSubmit = document.getElementById('btn-team-submit');
        const btnText = document.getElementById('btn-team-submit-text');
        
        btnSubmit.disabled = true;
        btnText.innerText = 'Registering...';

        try {
            const res = await authManager.secureFetch('http://localhost:5000/api/v1/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                document.getElementById('team-form').reset();
                document.getElementById('team-warehouse-container').classList.add('hidden');
                this.fetchAndRender(); // Refresh list
            } else {
                alert(data.error || 'Failed to create user');
            }
        } catch (e) {
            console.error(e);
            alert('Error creating user');
        } finally {
            btnSubmit.disabled = false;
            btnText.innerText = 'Register Member';
        }
    },

    async deleteUser(id) {
        if (!confirm('Are you sure you want to remove this team member?')) return;
        
        try {
            const res = await authManager.secureFetch(`http://localhost:5000/api/v1/users/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                this.fetchAndRender();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete user');
            }
        } catch(e) {
            console.error(e);
            alert('Error deleting user');
        }
    },

    async updateUser(id, payload) {
        const btnSubmit = document.getElementById('btn-edit-submit');
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Saving...';

        try {
            const res = await authManager.secureFetch(`http://localhost:5000/api/v1/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                document.getElementById('edit-user-modal').classList.add('hidden');
                this.fetchAndRender();
            } else {
                alert(data.error || 'Failed to update user');
            }
        } catch (e) {
            console.error(e);
            alert('Error updating user');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Save Changes';
        }
    },

    openEditModal(id, role, name, phone, warehouseId) {
        document.getElementById('edit-user-id').value = id;
        document.getElementById('edit-user-role').value = role;
        document.getElementById('edit-user-name').value = name;
        document.getElementById('edit-user-phone').value = phone;
        
        const warehouseContainer = document.getElementById('edit-warehouse-container');
        if (role === 'DRIVER') {
            warehouseContainer.classList.remove('hidden');
            if (warehouseId && warehouseId !== 'null') {
                document.getElementById('edit-user-warehouse').value = warehouseId;
            } else {
                document.getElementById('edit-user-warehouse').value = '';
            }
        } else {
            warehouseContainer.classList.add('hidden');
        }

        document.getElementById('edit-user-modal').classList.remove('hidden');
    },

    init() {
        this.fetchWarehouses();

        // Enlist Form Handler
        const form = document.getElementById('team-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('team-name').value;
                const email = document.getElementById('team-email').value;
                const phone = document.getElementById('team-phone').value;
                const role = document.getElementById('team-role').value;
                const password = document.getElementById('team-password').value;
                
                const payload = { name, email, phone, role, password };
                if (role === 'DRIVER') {
                    payload.assignedWarehouse = document.getElementById('team-warehouse').value;
                    if (!payload.assignedWarehouse) {
                        alert('Please select an assigned node for the driver.');
                        return;
                    }
                }
                
                this.createUser(payload);
            });
        }

        // Role change handler for Enlist Form
        const roleSelect = document.getElementById('team-role');
        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                const whContainer = document.getElementById('team-warehouse-container');
                if (e.target.value === 'DRIVER') {
                    whContainer.classList.remove('hidden');
                } else {
                    whContainer.classList.add('hidden');
                }
            });
        }

        // Edit Form Handlers
        const editForm = document.getElementById('edit-user-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-user-id').value;
                const role = document.getElementById('edit-user-role').value;
                const name = document.getElementById('edit-user-name').value;
                const phone = document.getElementById('edit-user-phone').value;
                
                const payload = { name, phone };
                if (role === 'DRIVER') {
                    payload.assignedWarehouse = document.getElementById('edit-user-warehouse').value;
                    if (!payload.assignedWarehouse) {
                        alert('Please select an assigned node for the driver.');
                        return;
                    }
                }
                
                this.updateUser(id, payload);
            });
        }

        const btnEditCancel = document.getElementById('btn-edit-cancel');
        if (btnEditCancel) {
            btnEditCancel.addEventListener('click', () => {
                document.getElementById('edit-user-modal').classList.add('hidden');
            });
        }

        window.deleteTeamMember = (id) => this.deleteUser(id);
        window.editTeamMember = (id, role, name, phone, warehouseId) => this.openEditModal(id, role, name, phone, warehouseId);
    }
};
