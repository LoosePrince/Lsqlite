import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: 'web',
  build: {
    outDir: '../dist/web',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/admin': 'http://localhost:3000',
      '/api': 'http://localhost:3000'
    }
  }
});