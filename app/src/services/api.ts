export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

class ApiService {
  private getHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('API Request to:', url);
      console.log('Request Options:', options);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      console.log('API Response Status:', response.status);

      // Handle 401 - try to refresh token
      if (response.status === 401) {
        console.warn('⚠️ Got 401, attempting to refresh token...');
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (refreshToken) {
          try {
            const refreshResponse = await this.refresh(refreshToken);
            if (refreshResponse.success && (refreshResponse.data as any)?.access_token) {
              console.log('✅ Token refreshed successfully');
              localStorage.setItem('access_token', (refreshResponse.data as any).access_token);
              
              // Retry the original request with new token
              return this.request(endpoint, options);
            }
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
          }
        }
        
        // If refresh failed or no refresh token, clear auth
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'API request failed');
      }

      return data;
    } catch (error: unknown) {
      // Distinguish between connection errors and other errors
      const err = error instanceof Error ? error : new Error('Network request failed');
      let errorMessage = err.message || 'Network request failed';
      let errorCode = 'API_ERROR';

      if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
        errorMessage = `Cannot connect to API server at ${API_BASE_URL}. Make sure the backend is running on port 3001.`;
        errorCode = 'CONNECTION_ERROR';
      }

      console.error('❌ API Error:', {
        message: errorMessage,
        url: `${API_BASE_URL}${endpoint}`,
        type: (err as { type?: string }).type || 'unknown',
        code: errorCode,
        errorObject: err,
      });

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }
  }

  // Auth endpoints
  async register(email: string, password: string, fullName: string, role: 'student' | 'instructor' = 'student') {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        role,
      }),
    });
  }

  async login(email: string, password: string) {
    console.log('🔐 [API] Calling login endpoint...');
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    console.log('🔐 [API] Login response:', {
      success: result.success,
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : [],
      hasError: !!result.error,
      errorMsg: result.error?.message,
    });
    
    // Debug the data structure
    if (result.data) {
      console.log('🔐 [API] Response data structure:', result.data);
    }
    
    return result;
  }

  async refresh(refreshToken: string) {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // User endpoints
  async getProfile() {
    return this.request('/users/profile');
  }

  async updateProfile(fullName: string, avatarUrl: string) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify({
        full_name: fullName,
        avatar_url: avatarUrl,
      }),
    });
  }

  async getProgress(userId: string) {
    return this.request(`/users/${userId}/progress`);
  }

  async getAchievements(userId: string) {
    return this.request(`/users/${userId}/achievements`);
  }

  async getLeaderboard(period: string = 'all-time', limit: number = 10) {
    return this.request(
      `/users/leaderboard?period=${period}&limit=${limit}`
    );
  }

  // Course endpoints
  async getCourses(search?: string, page: number = 1) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', page.toString());
    params.append('limit', '10');

    return this.request(`/courses?${params.toString()}`);
  }

  async getCourseById(courseId: string) {
    return this.request(`/courses/${courseId}`);
  }

  async getLessons(courseId: string, moduleId?: string) {
    const params = new URLSearchParams();
    if (moduleId) params.append('moduleId', moduleId);
    params.append('courseId', courseId);

    return this.request(`/courses/${courseId}/lessons?${params.toString()}`);
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const api = new ApiService();
