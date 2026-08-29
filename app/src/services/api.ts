import { API_BASE_URL } from '@/lib/apiConfig';

export { API_BASE_URL };

function buildApiUrl(endpoint: string): string {
  const base = (API_BASE_URL || '/api').trim();
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
}

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
      const url = buildApiUrl(endpoint);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });


      // Handle 401 - try to refresh token
      if (response.status === 401) {
        console.warn('⚠️ Got 401, attempting to refresh token...');
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (refreshToken) {
          try {
            const refreshResponse = await this.refresh(refreshToken);
            if (refreshResponse.success && (refreshResponse.data as any)?.access_token) {
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
        errorMessage = `Cannot connect to the API at ${API_BASE_URL}. Start the backend on port 3001 with: npm run dev --prefix backend`;
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
  async register(
    email: string,
    password: string,
    fullName: string,
    role: 'student' | 'instructor' = 'student',
    yearLevel: 1 | 2 | 3 | 4 = 1,
    section = '',
    teachingYearLevels?: number[],
    teachingSections?: string[]
  ) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        role,
        year_level: yearLevel,
        section,
        teaching_year_levels: teachingYearLevels,
        teaching_sections: teachingSections,
      }),
    });
  }

  async login(email: string, password: string) {
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    
    // Debug the data structure
    if (result.data) {
    }
    
    return result;
  }

  async verifyEmail(token: string) {
    return this.request(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });
  }

  async verifyEmailCode(email: string, code: string) {
    return this.request('/auth/verify-email-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  async resendVerification(email: string) {
    return this.request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email: string) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string, email = '', code = '') {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, email, code }),
    });
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

  async updateProfile(updates: {
    full_name?: string;
    avatar_url?: string;
    year_level?: 1 | 2 | 3 | 4 | null;
    teaching_year_levels?: (1 | 2 | 3 | 4)[];
  }) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async uploadAvatar(file: File) {
    const token = localStorage.getItem('access_token');
    const form = new FormData();
    form.append('avatar', file);
    const url = buildApiUrl('/users/avatar');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Failed to upload avatar');
    }
    return data as ApiResponse<{ avatar_url: string; user: any }>;
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
