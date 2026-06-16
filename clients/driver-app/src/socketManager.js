import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

class SocketManager {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.driverId = null;
    }

    connect(driverId, warehouseId) {
        this.driverId = driverId;
        if (this.socket) {
            this.socket.disconnect();
        }

        // Connect as driver
        this.socket = io(SOCKET_URL, {
            auth: {
                token: 'mock_driver_token_123',
                driverId: driverId,
                warehouseId: warehouseId
            }
        });

        this.socket.on('connect', () => {
            console.log('Connected to Dispatch Server:', this.socket.id);
            this._notify('status', 'connected');
            this.socket.emit('subscribe', 'drivers');
            this.socket.emit('subscribe', `warehouse:${warehouseId}`);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this._notify('status', 'disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection Error:', error.message);
            this._notify('status', 'error');
        });

        // Dispatch requests from admin
        this.socket.on('driver:dispatch_requested', (data) => {
            this._notify('driver:dispatch_requested', data);
        });
        
        this.socket.on('dispatch:accepted', (data) => {
            if (data.driverId === this.driverId) {
                this._notify('dispatch:accepted', data);
            }
        });

        // Server authoritative sync and telemetry
        this.socket.on('server:sync_state', (data) => {
            this._notify('server:sync_state', data);
        });

        this.socket.on('fleet:telemetry', (batch) => {
            const myData = batch.find(m => m.driverId === this.driverId);
            if (myData) {
                this._notify('fleet:telemetry', myData);
            }
        });

        this.socket.on('mission:arrived_destination', (data) => {
            if (data.driverId === this.driverId) {
                this._notify('mission:arrived_destination', data);
            }
        });

        this.socket.on('mission:completed', (data) => {
            if (data.driverId === this.driverId) {
                this._notify('mission:completed', data);
            }
        });
    }

    startEngine() {
        if (!this.socket || !this.socket.connected) return;
        this.socket.emit('driver:start_engine', { driverId: this.driverId });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    _notify(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }
}

export const socketManager = new SocketManager();
