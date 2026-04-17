import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { api } from '@/services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  setHydrated: (value: boolean) => void;
  loginAsync: (email: string, password: string) => Promise<boolean>;
  registerAsync: (email: string, password: string, fullName: string, role?: 'student' | 'instructor') => Promise<boolean>;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  addXP: (amount: number) => void;
  verifySession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setAuthenticated: (value) => set({ isAuthenticated: value }),
      
      setLoading: (value) => set({ isLoading: value }),
      
      setError: (error) => set({ error }),

      setHydrated: (value) => set({ isHydrated: value }),

      loginAsync: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          console.log('🔐 [AUTH] Starting login for:', email);
          const response = await api.login(email, password);
          
          console.log('🔐 [AUTH] Login response:', {
            success: response.success,
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
            error: response.error,
          });

          if (response.success && response.data) {
            const { user, access_token, refresh_token } = response.data as any;
            
            console.log('🔐 [AUTH] Extracted from response:', {
              hasUser: !!user,
              hasAccessToken: !!access_token,
              hasRefreshToken: !!refresh_token,
              accessTokenPrefix: access_token ? access_token.substring(0, 20) : 'MISSING',
              refreshTokenPrefix: refresh_token ? refresh_token.substring(0, 20) : 'MISSING',
            });

            if (!access_token || !refresh_token) {
              console.error('❌ [AUTH] Tokens missing in response:', {
                access_token: !!access_token,
                refresh_token: !!refresh_token,
              });
              set({ 
                error: 'Login failed: Missing authentication tokens',
                isLoading: false 
              });
              return false;
            }

            console.log('🔐 [AUTH] Saving tokens to localStorage...');
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            
            // Verify tokens were saved
            const saved_access = localStorage.getItem('access_token');
            const saved_refresh = localStorage.getItem('refresh_token');
            console.log('🔐 [AUTH] Verification - tokens saved:', {
              access_token_saved: !!saved_access,
              refresh_token_saved: !!saved_refresh,
            });

            set({ 
              user: user as User,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            console.log('✅ [AUTH] Login successful!');
            return true;
          } else {
            const errorMsg = response.error?.message || 'Login failed';
            console.error('❌ [AUTH] Login failed:', errorMsg);
            set({ error: errorMsg, isLoading: false });
            return false;
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Login failed';
          console.error('❌ [AUTH] Exception during login:', errorMsg);
          set({ error: errorMsg, isLoading: false });
          return false;
        }
      },

      registerAsync: async (email: string, password: string, fullName: string, role: 'student' | 'instructor' = 'student') => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.register(email, password, fullName, role);
          if (response.success) {
            set({ isLoading: false, error: null });
            return true;
          } else {
            const errorMsg = response.error?.message || 'Registration failed';
            set({ error: errorMsg, isLoading: false });
            return false;
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Registration failed';
          set({ error: errorMsg, isLoading: false });
          return false;
        }
      },
      
      login: (user) => set({ 
        user, 
        isAuthenticated: true, 
        error: null 
      }),
      
      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ 
          user: null, 
          isAuthenticated: false, 
          error: null 
        });
      },
      
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),
      
      addXP: (amount) => set((state) => ({
        user: state.user 
          ? { ...state.user, xp_total: state.user.xp_total + amount }
          : null
      })),

      verifySession: async () => {
        console.log('🔐 [AUTH] verifySession called');
        
        // Check tokens directly in localStorage
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');
        
        console.log('🔐 [AUTH] Token check:', {
          accessToken: !!accessToken,
          refreshToken: !!refreshToken,
          accessTokenPrefix: accessToken ? accessToken.substring(0, 20) : 'NONE',
          refreshTokenPrefix: refreshToken ? refreshToken.substring(0, 20) : 'NONE',
        });

        // Check if user is already authenticated (restored from localStorage by persist middleware)
        const state = useAuthStore.getState();
        
        console.log('🔐 [AUTH] Current auth state:', {
          isAuthenticated: state.isAuthenticated,
          hasUser: !!state.user,
          userId: state.user?.id,
        });
        
        // If already authenticated and user exists, session is valid
        if (state.isAuthenticated && state.user && accessToken) {
          console.log('✅ [AUTH] Session is valid (authenticated + user + token)');
          set({ isHydrated: true });
          return true;
        }
        
        // If tokens exist but user not in state, restore from tokens
        if (accessToken && refreshToken && !state.user) {
          console.log('✅ [AUTH] Tokens exist, restoring session');
          set({ isHydrated: true, isAuthenticated: true });
          return true;
        }
        
        // If no tokens, clear auth state
        if (!accessToken || !refreshToken) {
          console.warn('⚠️ [AUTH] No tokens in localStorage, clearing auth');
          set({ 
            user: null, 
            isAuthenticated: false, 
            isHydrated: true,
            error: null 
          });
          return false;
        }
        
        console.log('✅ [AUTH] Session verified');
        set({ isHydrated: true });
        return true;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);
