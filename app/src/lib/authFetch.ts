import { API_BASE_URL as API_BASE } from './apiConfig';

const FALLBACK_API_BASE = 'http://127.0.0.1:3001/api';
const LOCAL_3001_API = /^https?:\/\/(localhost|127\.0\.0\.1):3001\/api(?:\/|$)/;
const AUTH_REQUEST_TIMEOUT_MS = 90000;

const normalizeUrl = (url: string) => {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const base = (API_BASE || FALLBACK_API_BASE).replace(/\/+$/, '');
  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (base.endsWith('/api') && path.startsWith('/api/')) {
    path = path.slice(4);
  } else if (base.endsWith('/api') && path === '/api') {
    path = '';
  }

  return `${base}${path}`;
};

/**
 * A fetch wrapper that automatically refreshes the JWT access token
 * when a 401 is returned, then retries the original request once.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('access_token');
  const fullUrl = normalizeUrl(url);

  const headers: Record<string, string> = {
    ...(typeof options.headers === 'object' && options.headers !== null ? options.headers as Record<string, string> : {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Skip authenticated requests when the user is not signed in.
  if (!token && !url.startsWith('/auth/')) {
    const fallbackResponse = new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
    return fallbackResponse;
  }

  // Don't force Content-Type for FormData - let browser set it
  const requestOptions: RequestInit = {
    ...options,
    headers: headers,
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  const requestSignal = options.signal ?? controller.signal;

  let response: Response;
  try {
    response = await fetch(fullUrl, { ...requestOptions, signal: requestSignal });
  } catch (error) {
    // If connection failed, wait and retry once (helps with sleeping Render servers or quick restarts)
    const isRender = fullUrl.includes('onrender.com');
    const delay = isRender ? 1500 : 350;
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      response = await fetch(fullUrl, { ...requestOptions, signal: requestSignal });
    } catch {
      const reason = error instanceof Error ? error.message : 'Network connection failed';
      throw new Error(`Could not reach the API at ${fullUrl}: ${reason}. The backend may be restarting or unavailable.`);
    }
  } finally {
    window.clearTimeout(timeoutId);
  }

  // If 401, attempt to refresh the token and retry once
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE || FALLBACK_API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.success && refreshData.data?.access_token) {
            localStorage.setItem('access_token', refreshData.data.access_token);

            // Retry original request with the new token
            headers['Authorization'] = `Bearer ${refreshData.data.access_token}`;
            const retryOptions: RequestInit = {
              ...options,
              headers: headers,
            };
            response = await fetch(fullUrl, retryOptions);
          }
        } else if (refreshRes.status === 401) {
          // Refresh token is invalid — session is unrecoverable
          // Clear tokens and redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/auth/login';
        }
      } catch {
        // Refresh failed — fall through and return the original 401
      }
    }
  }

  return response;
}
