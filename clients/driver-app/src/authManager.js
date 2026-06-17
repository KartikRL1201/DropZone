class AuthManager {
    constructor() {
        this.accessToken = sessionStorage.getItem('accessToken') || null;
        
        let parsedUser = null;
        try {
            parsedUser = JSON.parse(sessionStorage.getItem('user'));
        } catch (e) {
            sessionStorage.removeItem('user');
        }
        this.user = parsedUser;
        
        this.API_URL = 'http://localhost:5000/api/v1';
    }

    setAuthData(accessToken, user) {
        this.accessToken = accessToken;
        if (user) {
            this.user = user;
            sessionStorage.setItem('user', JSON.stringify(user));
        }
        sessionStorage.setItem('accessToken', accessToken);
    }

    clearAuthData() {
        this.accessToken = null;
        this.user = null;
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
    }

    isAuthenticated() {
        return !!this.accessToken;
    }

    async login(email, password) {
        const response = await fetch(`${this.API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Login failed');
        }

        this.setAuthData(data.data.accessToken, data.data.user);
        return data.data;
    }

    async logout() {
        try {
            await this.secureFetch(`${this.API_URL}/auth/logout`, { method: 'POST' });
        } catch(e) {
            console.error('Logout failed', e);
        }
        this.clearAuthData();
        window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    async refresh() {
        const response = await fetch(`${this.API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            this.clearAuthData();
            throw new Error('Session expired');
        }

        this.setAuthData(data.data.accessToken, null);
        return data.data.accessToken;
    }

    async secureFetch(url, options = {}) {
        if (!options.headers) options.headers = {};
        
        if (this.accessToken) {
            options.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        options.credentials = 'include';

        let response = await fetch(url, options);

        if (response.status === 401 && !options._retry) {
            options._retry = true;
            try {
                const newAccessToken = await this.refresh();
                options.headers['Authorization'] = `Bearer ${newAccessToken}`;
                response = await fetch(url, options);
                
                if (response.status === 401) {
                    throw new Error('Refresh token invalid');
                }
            } catch (err) {
                this.clearAuthData();
                window.dispatchEvent(new CustomEvent('auth:expired'));
                throw err;
            }
        }

        return response;
    }
}

export const authManager = new AuthManager();
