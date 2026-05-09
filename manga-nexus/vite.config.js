import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.PACKAGE_VERSION': JSON.stringify(pkg.version) },
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist' },
});
