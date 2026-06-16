import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

class SocketManager {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    connect(token) {
        if (this.socket) {
            this.socket.disconnect();
        }

        this.socket = io(SOCKET_URL, {
            auth: {
                token
            }
        });

        this.socket.on('connect', () => {
            console.log('Connected to Crisis Event Stream:', this.socket.id);
            this._notify('status', 'connected');
            this.socket.emit('subscribe', 'hq');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from stream');
            this._notify('status', 'disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection Error:', error.message);
            this._notify('status', 'error');
        });

        // Listen for specific events
        this.socket.on('fleet:telemetry', (data) => this._notify('fleet:telemetry', data));
        this.socket.on('fleet:active_missions', (data) => this._notify('fleet:active_missions', data));
        this.socket.on('fleet:new_mission', (data) => this._notify('fleet:new_mission', data));
        this.socket.on('dispatch:accepted', (data) => this._notify('dispatch:accepted', data));
        this.socket.on('mission:completed', (data) => this._notify('mission:completed', data));
        this.socket.on('driver:returning', (data) => this._notify('driver:returning', data));
        this.socket.on('crisis:new', (data) => this._notify('crisis:new', data));
        this.socket.on('crisis:updated', (data) => this._notify('crisis:updated', data));
        this.socket.on('crisis:deleted', (data) => this._notify('crisis:deleted', data));
        this.socket.on('warehouse:updated', (data) => this._notify('warehouse:updated', data));
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
