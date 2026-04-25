/**
 * Base path/URL for API calls. In Vite dev, defaults to same-origin "/api" so the dev
 * server can proxy to the Express backend (see vite.config.ts) — the browser no longer
 * must open a direct TCP connection to port 3001, which is more reliable on some setups.
 * Override with VITE_API_URL in .env files (e.g. full Render URL for `npm run dev:online`).
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:3001/api');
