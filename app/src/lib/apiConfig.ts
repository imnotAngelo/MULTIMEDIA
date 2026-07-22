/**
 * Base path/URL for API calls.
 *
 * In local development, prefer the running Express backend directly on port 3001 so
 * browser requests do not depend on the Vite proxy. If a deployment-specific override
 * is provided via VITE_API_URL, that value still wins.
 */
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const localDevApiUrl = 'http://127.0.0.1:3001/api';

export const API_BASE_URL = configuredApiUrl || localDevApiUrl;

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
