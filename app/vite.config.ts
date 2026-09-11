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
});
