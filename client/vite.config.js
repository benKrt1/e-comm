import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API calls in dev: the browser talks to :5173/api/...,
    // Vite forwards to Express on :5000 — so the httpOnly auth cookie
    // needs no cross-site configuration during development.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
