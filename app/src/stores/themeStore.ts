import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      
      setTheme: (theme: Theme) => {
        set({ theme });
        const html = document.documentElement;
        html.classList.toggle('dark', theme === 'dark');
        html.classList.toggle('light', theme === 'light');
        html.style.colorScheme = theme;
      },
      
      toggleTheme: () => {
        const current = get().theme;
        const next = current === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },
    }),
    {
      name: 'theme-store',
      onRehydrate: (state) => {
        // Apply saved theme on hydration
        const html = document.documentElement;
        const theme = state?.theme ?? 'dark';
        html.classList.toggle('dark', theme === 'dark');
        html.classList.toggle('light', theme === 'light');
        html.style.colorScheme = theme;
      },
    }
  )
);
