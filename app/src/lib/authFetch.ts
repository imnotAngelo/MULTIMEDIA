const API_BASE = 'http://localhost:3001/api';

/**
 * A fetch wrapper that automatically refreshes the JWT access token
 * when a 401 is returned, then retries the original request once.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('access_token');

  // Prepend API_BASE if URL is relative
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

  const headers: Record<string, string> = {
    ...(typeof options.headers === 'object' && options.headers !== null ? options.headers as Record<string, string> : {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't force Content-Type for FormData - let browser set it
  const requestOptions: RequestInit = {
    ...options,
    headers: headers,
  };

  let response = await fetch(fullUrl, requestOptions);

  // If 401, attempt to refresh the token and retry once
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
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
