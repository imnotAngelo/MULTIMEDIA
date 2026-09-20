/**
 * Base path/URL for API calls.
 *
 * Local development should always target the running Express backend on port 3001.
 * Keep the deployed API only for explicit online / production builds.
 */
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const deployedApiUrl = 'https://multimedia-2-x7ol.onrender.com/api';
const localDevApiUrl = 'http://127.0.0.1:3001/api';

// Check if user explicitly requested online mode via URL parameter (?api=online) or localStorage
const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const urlMode = searchParams?.get('api');
if (urlMode === 'online' || urlMode === 'local') {
  try {
    localStorage.setItem('api_mode', urlMode);
  } catch {}
}
const storedMode = typeof window !== 'undefined' ? localStorage.getItem('api_mode') : null;
const forceOnline = storedMode === 'online' || urlMode === 'online' || import.meta.env.MODE === 'online' || Boolean(import.meta.env.VITE_ONLINE);

const isLocalDevelopment = !forceOnline && !import.meta.env.PROD;

export const API_BASE_URL = isLocalDevelopment
  ? localDevApiUrl
  : (configuredApiUrl || deployedApiUrl);

export const IS_ONLINE_API = !isLocalDevelopment;

/**
 * Helper to switch between local backend and online Render API at runtime
 */
export function toggleApiMode(targetMode?: 'online' | 'local'): 'online' | 'local' {
  const current = isLocalDevelopment ? 'local' : 'online';
  const next = targetMode || (current === 'local' ? 'online' : 'local');
  try {
    localStorage.setItem('api_mode', next);
  } catch {}
  window.location.reload();
  return next;
}

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

  const trimmed = pathOrUrl.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const isLocalBackendHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());

      // Lesson records created locally can contain a localhost URL. That URL
      // must be replaced with the current configured backend in every mode,
      // otherwise deployed students try to connect to their own computer.
      if (isLocalBackendHost) {
        if (API_BASE_URL.startsWith('/')) {
          return `${url.pathname}${url.search}`;
        }

        return `${new URL(API_BASE_URL).origin}${url.pathname}${url.search}`;
      }

      return trimmed;
    } catch {
      return trimmed;
    }
  }

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

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

export function isLocalAssetUrl(pathOrUrl?: string | null): boolean {
  if (!pathOrUrl) return false;

  const trimmed = pathOrUrl.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith('/')) return true;

  try {
    const url = new URL(trimmed);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

