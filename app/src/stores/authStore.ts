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
  registerAsync: (
    email: string,
    password: string,
    fullName: string,
    role: 'student' | 'instructor',
    yearLevel: 1 | 2 | 3 | 4,
    section: string,
    teachingYearLevels?: number[],
    teachingSections?: string[]
  ) => Promise<boolean>;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  verifySession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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

          const response = await api.login(email, password);
          
          // Debug: Log raw response

          if (!response) {
            throw new Error("No response from server");
          }

          if (response.success && response.data) {
            const { user, access_token, refresh_token } = response.data as any;

            if (!access_token || !refresh_token) {
              set({ 
                error: 'Login failed: Missing authentication tokens',
                isLoading: false 
              });
              return false;
            }

            // Save tokens
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);

            set({ 
              user: user as User,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });

            return true;
          } else {
            const errorMsg = response.error?.message || response.message || 'Invalid email or password';
            set({ error: errorMsg, isLoading: false });
            return false;
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Login failed. Please try again.';
          set({ error: errorMsg, isLoading: false });
          return false;
        }
      },

      registerAsync: async (
        email: string,
        password: string,
        fullName: string,
        role: 'student' | 'instructor' = 'student',
        yearLevel: 1 | 2 | 3 | 4 = 1,
        section = '',
        teachingYearLevels?: number[],
        teachingSections?: string[]
      ) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.register(email, password, fullName, role, yearLevel, section, teachingYearLevels, teachingSections);
          
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
      
      login: (user) => set({ user, isAuthenticated: true, error: null }),
      
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
      
      verifySession: async () => {
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');
        
        const state = get();

        if (state.isAuthenticated && state.user && accessToken) {
          set({ isHydrated: true });
          return true;
        }

        if (accessToken && refreshToken) {
          set({ isHydrated: true, isAuthenticated: true });
          return true;
        }

        set({ 
          user: null, 
          isAuthenticated: false, 
          isHydrated: true 
        });
        return false;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHydrated(true);
      },
    }
  )
);