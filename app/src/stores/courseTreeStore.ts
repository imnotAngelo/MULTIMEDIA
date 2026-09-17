import { create } from 'zustand';
import { authFetch } from '@/lib/authFetch';

export interface CourseTreeUnit {
  id: string;
  title: string;
  description?: string;
  createdAt?: string;
  yearLevel?: number | null;
  section?: string | null;
  status?: string;
}

export interface CourseTreeLesson {
  id: string;
  unitId: string;
  title: string;
  content?: string;
  createdAt?: string;
  slideCount?: number;
  slides?: any[];
  video_url?: string;
  app_link?: string;
  app_name?: string;
  pdfUrl?: string;
  originalFormat?: string;
  status?: string;
}

export interface CourseTreeData {
  units: CourseTreeUnit[];
  lessons: CourseTreeLesson[];
  loadedAt: number;
}

interface CourseTreeState {
  cache: Record<string, CourseTreeData>;
  loading: Record<string, boolean>;
  setUserCourseTree: (userId: string | null, tree: CourseTreeData) => void;
  clearUserCourseTree: (userId?: string | null) => void;
  clearAll: () => void;
  loadUserCourseTree: (userId: string | null) => Promise<CourseTreeData>;
}

const emptyTree = (): CourseTreeData => ({
  units: [],
  lessons: [],
  loadedAt: 0,
});

export const useCourseTreeStore = create<CourseTreeState>((set, get) => ({
  cache: {},
  loading: {},

  setUserCourseTree: (userId, tree) => {
    if (!userId) return;
    set((state) => ({
      cache: {
        ...state.cache,
        [userId]: tree,
      },
    }));
  },

  clearUserCourseTree: (userId) => {
    if (!userId) return;
    set((state) => {
      const nextCache = { ...state.cache };
      delete nextCache[userId];
      const nextLoading = { ...state.loading };
      delete nextLoading[userId];
      return { cache: nextCache, loading: nextLoading };
    });
  },

  clearAll: () => {
    set({ cache: {}, loading: {} });
  },

  loadUserCourseTree: async (userId) => {
    if (!userId) {
      return emptyTree();
    }

    set((state) => ({
      loading: {
        ...state.loading,
        [userId]: true,
      },
    }));

    try {
      const unitsResponse = await authFetch('/units', { cache: 'no-store' });
      const unitsData = await unitsResponse.json();

      if (!unitsResponse.ok || !unitsData.success) {
        throw new Error(unitsData.error?.message || 'Could not load courses');
      }

      const unitList = Array.isArray(unitsData.data) ? unitsData.data : [];

      const lessonResults = await Promise.all(
        unitList.map(async (unit: any) => {
          const lessonsResponse = await authFetch(`/units/${unit.id}/lessons`);
          const lessonsData = await lessonsResponse.json();

          if (!lessonsResponse.ok || !lessonsData.success) {
            throw new Error(lessonsData.error?.message || `Could not load lessons for ${unit.title}`);
          }

          const unitLessons = Array.isArray(lessonsData.data) ? lessonsData.data : [];
          return unitLessons.map((lesson: any) => ({
            ...lesson,
            unitId: unit.id,
            pdfUrl: lesson.pdfUrl || lesson.pdf_url || '',
            originalFormat: lesson.originalFormat || lesson.original_format || '',
          }));
        })
      );

      const allLessons = lessonResults.flat();
      const tree = {
        units: unitList,
        lessons: allLessons,
        loadedAt: Date.now(),
      };

      set((state) => ({
        cache: {
          ...state.cache,
          [userId]: tree,
        },
        loading: {
          ...state.loading,
          [userId]: false,
        },
      }));

      return tree;
    } catch (error) {
      const existing = get().cache[userId] ?? emptyTree();
      set((state) => ({
        loading: {
          ...state.loading,
          [userId]: false,
        },
      }));
      return existing;
    }
  },
}));
