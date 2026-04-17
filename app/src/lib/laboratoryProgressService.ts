import { authFetch } from './authFetch';

export interface LaboratoryProgress {
  id: string;
  user_id: string;
  unit_id: string;
  total_xp_earned: number;
  total_completed_phases: number;
  total_phases: number;
  last_accessed_module_id?: string;
  started_at: string;
  last_updated_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PhaseProgress {
  id: string;
  user_id: string;
  module_id: string;
  unit_id: string;
  phase: 'theory' | 'interactive' | 'activity' | 'creative';
  lesson_id?: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  xp_earned: number;
  interaction_count: number;
  time_spent_seconds: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LabStatistics {
  totalXpEarned: number;
  totalUnitsStarted: number;
  totalUnitsCompleted: number;
  totalPhasesCompleted: number;
  totalTimeSpentSeconds: number;
  recentProgress: LaboratoryProgress[];
}

/**
 * Get laboratory progress for a user in a specific unit
 */
export async function getLaboratoryProgress(unitId: string): Promise<{
  progress: LaboratoryProgress;
  phaseProgress: PhaseProgress[];
}> {
  try {
    const token = await getAuthToken();

    const API_BASE = 'http://localhost:3001/api';
    const response = await fetch(`${API_BASE}/laboratories/${unitId}/progress`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch laboratory progress: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching laboratory progress:', error);
    throw error;
  }
}

/**
 * Check if a JWT token is expired
 */
function isTokenExpired(token: string): boolean {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('⚠️ [AUTH] Invalid token format');
      return true;
    }

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();

    const isExpired = currentTime > expirationTime;
    const timeUntilExpiry = Math.round((expirationTime - currentTime) / 1000);

    console.log('🔐 [AUTH] Token expiration check:', {
      isExpired,
      expiresIn: timeUntilExpiry + ' seconds',
      expirationTime: new Date(expirationTime).toISOString(),
      currentTime: new Date(currentTime).toISOString(),
    });

    return isExpired;
  } catch (error) {
    console.warn('⚠️ [AUTH] Error checking token expiration:', error);
    return true; // Assume expired if we can't verify
  }
}

/**
 * Get authentication token with automatic refresh if expired
 */
async function getAuthToken(): Promise<string> {
  let token: string | null = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');

  console.log('🔐 [AUTH] Token check:');
  console.log('  - Access token exists:', !!token);
  console.log('  - Refresh token exists:', !!refreshToken);

  // Check if token exists and is not expired
  if (token && !isTokenExpired(token)) {
    console.log('✅ [AUTH] Access token is valid');
    return token;
  }

  // Token is missing or expired, try to refresh
  console.warn('⚠️ [AUTH] Access token missing or expired. Attempting refresh...');

  if (!refreshToken) {
    console.error('❌ [AUTH] No refresh token available. User must log in again.');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    throw new Error('Session expired. Please log in again.');
  }

  try {
    console.log('🔄 [AUTH] Calling refresh endpoint...');
    const API_BASE = 'http://localhost:3001/api';
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    console.log('🔐 [AUTH] Refresh response status:', response.status);

    if (!response.ok) {
      console.error('❌ [AUTH] Token refresh failed with status:', response.status);
      const errorData = await response.json().catch(() => null);
      console.error('❌ [AUTH] Refresh error:', errorData);
      
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      throw new Error('Failed to refresh session. Please log in again.');
    }

    const data = await response.json();
    console.log('🔐 [AUTH] Refresh response:', {
      success: data.success,
      hasAccessToken: !!data.data?.access_token,
    });

    if (!data.success || !data.data?.access_token) {
      console.error('❌ [AUTH] Invalid refresh response');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      throw new Error('Invalid refresh response. Please log in again.');
    }

    const newToken: string = data.data.access_token;
    token = newToken;
    localStorage.setItem('access_token', newToken);
    console.log('✅ [AUTH] Access token refreshed successfully');

    return newToken;
  } catch (error) {
    console.error('❌ [AUTH] Token refresh failed:', error);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    throw error;
  }
}

/**
 * Update phase progress (create or update)
 */
export async function updatePhaseProgress(
  moduleId: string,
  unitId: string,
  phase: 'theory' | 'interactive' | 'activity' | 'creative',
  options: {
    lessonId?: string;
    status?: 'locked' | 'available' | 'in_progress' | 'completed';
    xpEarned?: number;
    interactionCount?: number;
    timeSpentSeconds?: number;
  } = {}
): Promise<PhaseProgress> {
  try {
    // Get token with automatic refresh if needed
    const token = await getAuthToken();

    const payload = {
      moduleId,
      unitId,
      phase,
      lessonId: options.lessonId,
      status: options.status,
      xpEarned: options.xpEarned,
      interactionCount: options.interactionCount,
      timeSpentSeconds: options.timeSpentSeconds,
    };

    console.log('📤 [LAB_PROGRESS] Sending payload:', payload);

    // DIRECT FETCH - with explicit Authorization header
    const API_BASE = 'http://localhost:3001/api';
    const response = await fetch(`${API_BASE}/laboratories/phase-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('📥 [LAB_PROGRESS] Response status:', response.status);
    
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('📥 [LAB_PROGRESS] Raw response:', responseText);
    } catch (e) {
      console.error('❌ Could not read response text:', e);
      responseText = '[Could not read response]';
    }

    // Handle 401 - token expired, try to refresh and retry
    if (response.status === 401) {
      console.warn('⚠️ [LAB_PROGRESS] Got 401 Unauthorized. Token may have expired.');
      try {
        console.log('🔄 [LAB_PROGRESS] Attempting to refresh token and retry...');
        const newToken = await getAuthToken(); // This will refresh if needed
        
        // Retry the request with new token
        console.log('🔄 [LAB_PROGRESS] Retrying request with refreshed token...');
        return updatePhaseProgress(moduleId, unitId, phase, options);
      } catch (refreshError) {
        console.error('❌ [LAB_PROGRESS] Failed to refresh token and retry:', refreshError);
        throw refreshError;
      }
    }

    if (!response.ok) {
      console.error('❌ [LAB_PROGRESS] Request failed with status', response.status);
      console.error('❌ [LAB_PROGRESS] Response body:', responseText);
      
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(
          `Failed to update phase progress: ${response.status}\nMessage: ${errorData?.error?.message || responseText}`
        );
      } catch (parseError) {
        throw new Error(
          `Failed to update phase progress: ${response.status}\nResponse: ${responseText.substring(0, 200)}`
        );
      }
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ [LAB_PROGRESS] Parsed response:', data);
    } catch (parseError) {
      console.error('❌ [LAB_PROGRESS] Failed to parse JSON:', parseError);
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
    }

    if (!data.data) {
      console.error('❌ [LAB_PROGRESS] No data in response:', data);
      throw new Error('No data returned from server');
    }

    console.log('✅ [LAB_PROGRESS] Success! Returned status:', data.data.status);
    return data.data;
  } catch (error) {
    console.error('❌ [LAB_PROGRESS] Error updating phase progress:', error);
    if (error instanceof Error) {
      console.error('❌ [LAB_PROGRESS] Error message:', error.message);
    }
    throw error;
  }
}

/**
 * Get detailed phase progress for a unit
 */
export async function getPhaseProgressDetails(unitId: string): Promise<PhaseProgress[]> {
  try {
    const token = await getAuthToken();

    const API_BASE = 'http://localhost:3001/api';
    const response = await fetch(`${API_BASE}/laboratories/${unitId}/phase-details`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch phase details: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching phase progress details:', error);
    throw error;
  }
}

/**
 * Get user's laboratory statistics
 */
export async function getLabStatistics(): Promise<LabStatistics> {
  try {
    const token = await getAuthToken();

    const API_BASE = 'http://localhost:3001/api';
    const response = await fetch(`${API_BASE}/laboratories/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch lab statistics: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching lab statistics:', error);
    throw error;
  }
}

/**
 * Mark a laboratory module as completed
 */
export async function completeLaboratory(unitId: string): Promise<LaboratoryProgress> {
  try {
    const token = await getAuthToken();

    const API_BASE = 'http://localhost:3001/api';
    const response = await fetch(`${API_BASE}/laboratories/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        unitId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to complete laboratory: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error completing laboratory:', error);
    throw error;
  }
}
