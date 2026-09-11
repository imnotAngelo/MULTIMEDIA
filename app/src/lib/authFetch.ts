import { API_BASE_URL as API_BASE } from './apiConfig';

const FALLBACK_API_BASE = 'http://127.0.0.1:3001/api';
const LOCAL_3001_API = /^https?:\/\/(localhost|127\.0\.0\.1):3001\/api(?:\/|$)/;

const normalizeUrl = (url: string) => {
  const baseUrl = (API_BASE || FALLBACK_API_BASE).replace(/\/$/, '');

  if (LOCAL_3001_API.test(url)) {
    const suffix = url.replace(/^https?:\/\/(localhost|127\.0\.0\.1):3001\/api/, '') || '/';
    return `${baseUrl}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
  }

  if (url.startsWith('http')) {
    return url;
  }
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
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

  let response: Response;
  try {
    response = await fetch(fullUrl, requestOptions);
  } catch (error) {
    // A dev backend restart can briefly interrupt the first request.
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      response = await fetch(fullUrl, requestOptions);
    } catch {
      const reason = error instanceof Error ? error.message : 'Network connection failed';
      throw new Error(`Could not reach the API at ${fullUrl}: ${reason}`);
    }
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
