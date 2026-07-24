import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Keep legacy process.env.* reads working without breaking Vite HMR
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env.REACT_APP_GEMINI_API_KEY': JSON.stringify(
      process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''
    ),
    'process.env.REACT_APP_VAPID_PUBLIC_KEY': JSON.stringify(
      process.env.REACT_APP_VAPID_PUBLIC_KEY || ''
    ),
  },
  server: {
    // Avoid silent port hop → HMR WebSocket token=undefined failures
    strictPort: true,
    port: 5173,
    host: true,
    hmr: {
      // Explicit host keeps the WS client connected when opened via LAN / OneDrive paths
      protocol: 'ws',
      // Let Vite inject the real port; do not hardcode clientPort unless behind a proxy
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
});
