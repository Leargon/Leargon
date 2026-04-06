import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const pkgVersion = JSON.parse(readFileSync('./package.json', 'utf-8')).version as string;
const appVersion = process.env.VITE_APP_VERSION ?? pkgVersion;

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: process.env.VITE_BACKEND_URL ? {
      '/api': {
        target: process.env.VITE_BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    } : undefined,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react';
          if (id.includes('@mui/') || id.includes('@emotion/')) return 'vendor-mui';
          if (id.includes('@tanstack/') || id.includes('axios')) return 'vendor-query';
          if (id.includes('@xyflow/') || id.includes('@dagrejs/')) return 'vendor-flow';
          if (id.includes('@azure/msal')) return 'vendor-msal';
        },
      },
    },
  },
});
