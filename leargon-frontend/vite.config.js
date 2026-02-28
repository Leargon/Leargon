import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vite.dev/config/
export default defineConfig({
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
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
                    'vendor-query': ['@tanstack/react-query', 'axios'],
                    'vendor-flow': ['@xyflow/react', '@dagrejs/dagre'],
                    'vendor-msal': ['@azure/msal-browser', '@azure/msal-react'],
                },
            },
        },
    },
});
