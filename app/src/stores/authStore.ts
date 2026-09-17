import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { api } from '@/services/api';
import { useCourseTreeStore } from '@/stores/courseTreeStore';

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
  loginAsync: (email: string, password: string, adminSecret?: string) => Promise<boolean>;
  registerAsync: (
    email: string,
    password: string,
    fullName: string,
    role: 'student' | 'instructor' | 'admin',
    yearLevel: 1 | 2 | 3 | 4,
    section: string,
    teachingYearLevels?: number[],
    teachingSections?: string[],
    adminSecret?: string
  ) => Promise<boolean>;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  verifySession: () => Promise<boolean>;
}

const clearPersistedAuth = () => {
  const localKeys = [
    'access_token',
    'refresh_token',
    'auth-storage',
    'notifications',
    'theme-storage',
    'aether-course-quick-action',
  ];

  localKeys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage access issues during hard reset
    }
  });

  try {
    const sessionKeys = [...Array(sessionStorage.length).keys()].map((index) => sessionStorage.key(index) || '').filter(Boolean);
    sessionKeys.forEach((key) => sessionStorage.removeItem(key));
    sessionStorage.clear();
  } catch {
    // ignore storage access issues during hard reset
  }

  try {
    useCourseTreeStore.getState().clearAll();
  } catch {
    // ignore
  }
};

const getPersistedUserId = () => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.user?.id ?? null;
  } catch {
    return null;
  }
};

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

      loginAsync: async (email: string, password: string, adminSecret?: string) => {
        set({ isLoading: true, error: null });

        try {
          clearPersistedAuth();
          try {
            useAuthStore.persist?.clearStorage?.();
          } catch {
            // ignore persisted-state cleanup issues during login
          }
          set({ user: null, isAuthenticated: false });

          const response = await api.login(email, password, adminSecret);

          if (!response) {
            throw new Error('No response from server');
          }

          if (response.success && response.data) {
            const { user, access_token, refresh_token } = response.data as any;

            if (!access_token || !refresh_token) {
              clearPersistedAuth();
              set({ 
                error: 'Login failed: Missing authentication tokens',
                isLoading: false,
                user: null,
                isAuthenticated: false,
              });
              return false;
            }

            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);

            set({ 
              user: user as User,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              isHydrated: true,
            });

            return true;
          } else {
            clearPersistedAuth();
            const errorMsg = response.error?.message || response.message || 'Invalid email or password';
            set({ error: errorMsg, isLoading: false, user: null, isAuthenticated: false });
            return false;
          }
        } catch (err: any) {
          clearPersistedAuth();
          const errorMsg = err.message || 'Login failed. Please try again.';
          set({ error: errorMsg, isLoading: false, user: null, isAuthenticated: false });
          return false;
        }
      },

      registerAsync: async (
        email: string,
        password: string,
        fullName: string,
        role: 'student' | 'instructor' | 'admin' = 'student',
        yearLevel: 1 | 2 | 3 | 4 = 1,
        section = '',
        teachingYearLevels?: number[],
        teachingSections?: string[],
        adminSecret?: string
      ) => {
        set({ isLoading: true, error: null });
        try {
          clearPersistedAuth();
          set({ user: null, isAuthenticated: false });

          const response = await api.register(email, password, fullName, role, yearLevel, section, teachingYearLevels, teachingSections, adminSecret);
          
          if (response.success) {
            set({ isLoading: false, error: null, user: null, isAuthenticated: false, isHydrated: true });
            return true;
          } else {
            const errorMsg = response.error?.message || 'Registration failed';
            set({ error: errorMsg, isLoading: false, user: null, isAuthenticated: false });
            return false;
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Registration failed';
          set({ error: errorMsg, isLoading: false, user: null, isAuthenticated: false });
          return false;
        }
      },
      
      login: (user) => {
        const persistedUserId = getPersistedUserId();
        const activeUserId = user?.id ?? null;
        if (persistedUserId && persistedUserId !== activeUserId) {
          clearPersistedAuth();
        }
        set({ user, isAuthenticated: true, error: null });
      },
      
      logout: () => {
        clearPersistedAuth();
        try {
          useAuthStore.persist?.clearStorage?.();
        } catch {
          // ignore persisted-state cleanup issues during logout
        }
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

        if (!accessToken || !refreshToken) {
          clearPersistedAuth();
          set({ 
            user: null, 
            isAuthenticated: false, 
            isHydrated: true 
          });
          return false;
        }

        try {
          const profileResponse: any = await api.getProfile();

          if (profileResponse?.success && profileResponse.data) {
            const serverUser = profileResponse.data?.user ?? profileResponse.data;
            const persistedUserId = getPersistedUserId();
            const currentUserId = (get().user as User | null)?.id ?? persistedUserId ?? null;

            if (currentUserId && serverUser?.id && currentUserId !== serverUser.id) {
              clearPersistedAuth();
              set({
                user: null,
                isAuthenticated: false,
                isHydrated: true,
                error: null,
              });
              return false;
            }

            set({
              user: serverUser as User,
              isAuthenticated: true,
              isHydrated: true,
              error: null,
            });
            return true;
          }

          clearPersistedAuth();
          set({
            user: null,
            isAuthenticated: false,
            isHydrated: true,
            error: null,
          });
          return false;
        } catch {
          clearPersistedAuth();
          set({
            user: null,
            isAuthenticated: false,
            isHydrated: true,
            error: null,
          });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
      onRehydrateStorage: () => (state) => {
        const hasTokens = !!localStorage.getItem('access_token') && !!localStorage.getItem('refresh_token');

        if (!hasTokens) {
          localStorage.removeItem('auth-storage');
          if (state) {
            state.setUser(null);
            state.setAuthenticated(false);
          }
        }

        if (state) state.setHydrated(true);
      },
    }
  )
);