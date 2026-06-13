import 'dotenv/config';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env.PORT || '3000';
const apiTarget = `http://localhost:${apiPort}`;

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
      '/admin': apiTarget,
      '/api': apiTarget
    }
  }
});