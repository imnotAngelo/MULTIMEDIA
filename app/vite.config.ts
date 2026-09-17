import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const configuredApiUrl = process.env.VITE_API_URL?.trim();
const isLocalDevelopment = process.env.NODE_ENV !== 'online' && !process.env.NODE_ENV?.includes('production');
const apiProxyTarget = isLocalDevelopment
  ? 'http://127.0.0.1:3001'
  : (configuredApiUrl ? configuredApiUrl.replace(/\/api\/?$/, '') : 'http://127.0.0.1:3001');

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('grapesjs')) return 'vendor-editor';
            if (id.includes('pdfjs-dist') || id.includes('jspdf') || id.includes('@cyntler')) return 'vendor-pdf';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@radix-ui')) return 'vendor-ui';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
