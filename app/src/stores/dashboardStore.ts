import { create } from 'zustand';
import type { 
  DashboardStats, 
  WeeklyActivity, 
  Recommendation,
  ModuleProgress,
  LeaderboardEntry 
} from '@/types';

interface DashboardState {
  stats: DashboardStats | null;
  weeklyActivity: WeeklyActivity[];
  recommendations: Recommendation[];
  moduleProgress: ModuleProgress[];
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setStats: (stats: DashboardStats) => void;
  setWeeklyActivity: (activity: WeeklyActivity[]) => void;
  setRecommendations: (recommendations: Recommendation[]) => void;
  setModuleProgress: (progress: ModuleProgress[]) => void;
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  setLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  updateLessonProgress: (moduleId: string, completed: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  weeklyActivity: [],
  recommendations: [],
  moduleProgress: [],
  leaderboard: [],
  isLoading: false,
  error: null,

  setStats: (stats) => set({ stats }),
  
  setWeeklyActivity: (activity) => set({ weeklyActivity: activity }),
  
  setRecommendations: (recommendations) => set({ recommendations }),
  
  setModuleProgress: (progress) => set({ moduleProgress: progress }),
  
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  
  setLoading: (value) => set({ isLoading: value }),
  
  setError: (error) => set({ error }),
  
  updateLessonProgress: (moduleId, completed) => set((state) => {
    const updatedProgress = state.moduleProgress.map((mp) => {
      if (mp.module_id === moduleId) {
        const newCompleted = completed 
          ? mp.completed_lessons + 1 
          : mp.completed_lessons;
        return {
          ...mp,
          completed_lessons: newCompleted,
          progress: Math.round((newCompleted / mp.total_lessons) * 100)
        };
      }
      return mp;
    });
    return { moduleProgress: updatedProgress };
  }),
}));
