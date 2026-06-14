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
        this.socket.on('driver:position', (data) => this._notify('driver:position', data));
        this.socket.on('crisis:new', (data) => this._notify('crisis:new', data));
        this.socket.on('crisis:updated', (data) => this._notify('crisis:updated', data));
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
