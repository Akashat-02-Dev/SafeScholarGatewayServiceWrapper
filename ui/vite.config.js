import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[Vite Proxy Error]:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Vite Proxy Req]:', req.method, req.url);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
            console.log('[Vite Proxy WS Req]:', req.url);
          });
          proxy.on('open', (proxySocket) => {
            console.log('[Vite Proxy WS Socket Opened]');
          });
          proxy.on('close', (res, socket, head) => {
            console.log('[Vite Proxy WS Socket Closed]');
          });
        }
      },
    },
  },
})
