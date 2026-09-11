import React from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="
        relative p-2 rounded-full
        bg-white/10 hover:bg-white/20
        dark:bg-slate-800/30 dark:hover:bg-slate-700/50
        backdrop-blur-md border border-white/20 dark:border-slate-700/30
        transition-all duration-300 ease-out
        hover:shadow-lg hover:shadow-blue-500/20
        dark:hover:shadow-blue-500/10
        group
      "
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5">
        {theme === 'dark' ? (
          <Sun 
            className="
              absolute inset-0 w-5 h-5
              text-yellow-300 transition-all duration-300
              opacity-100 scale-100
              group-hover:text-yellow-200
            "
          />
        ) : (
          <Moon 
            className="
              absolute inset-0 w-5 h-5
              text-slate-600 transition-all duration-300
              opacity-100 scale-100
              group-hover:text-slate-700
            "
          />
        )}
      </div>
    </button>
  );
};
