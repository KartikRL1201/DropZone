import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3003,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
});
