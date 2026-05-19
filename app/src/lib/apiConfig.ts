/**
 * Base path/URL for API calls. In Vite dev, defaults to same-origin "/api" so the dev
 * server can proxy to the Express backend (see vite.config.ts) — the browser no longer
 * must open a direct TCP connection to port 3001, which is more reliable on some setups.
 * Override with VITE_API_URL in .env files (e.g. full Render URL for `npm run dev:online`).
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:3001/api');

/**
 * Resolve a backend-relative path (e.g. "/uploads/announcements/x.pdf") to a
 * fully-qualified URL that will reach the Express server, regardless of whether
 * the frontend is served from the same origin (dev / colocated prod) or a
 * different origin (e.g. Vercel frontend → Render backend).
 *
 * - Absolute URLs (http/https) are returned unchanged.
 * - Empty/null inputs return an empty string.
 * - Otherwise the path is appended to the backend origin derived from
 *   API_BASE_URL (stripping the trailing "/api" segment).
 */
export function resolveBackendAssetUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;

  // If API_BASE_URL is itself a path (e.g. "/api"), the asset is same-origin —
  // just return the path so the browser/dev-proxy can handle it.
  if (API_BASE_URL.startsWith('/')) {
    return normalizedPath;
  }

  // Otherwise strip the trailing "/api" (or any path) from API_BASE_URL to get the origin.
  try {
    const origin = new URL(API_BASE_URL).origin;
    return `${origin}${normalizedPath}`;
  } catch {
    return normalizedPath;
  }
}
