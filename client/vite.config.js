import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API calls in dev: the browser talks to :5173/api/...,
    // Vite forwards to Express on :5001 — so the httpOnly auth cookie
    // needs no cross-site configuration during development.
    // (5001, not 5000: macOS AirPlay Receiver squats on 5000.)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
});
