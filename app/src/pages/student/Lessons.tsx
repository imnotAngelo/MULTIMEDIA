import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  RefreshCw,
  Video,
  Link as LinkIcon,
  ExternalLink,
  Zap,
  Layers,
  Sparkles,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { SlideViewer } from './SlideViewer';
import { useAuthStore } from '@/stores/authStore';
import { useCourseTreeStore } from '@/stores/courseTreeStore';
import { usePageCache } from '@/stores/pageCacheStore';
import { AetherLoader } from '@/components/AetherLoader';

interface Unit {
  id: string;
  title: string;
  description: string;
  lessonCount?: number;
  createdAt?: string;
  yearLevel?: number;
  section?: string;
}

interface Lesson {
  id: string;
  unitId: string;
  title: string;
  content: string;
  createdAt: string;
  slideCount?: number;
  slides?: any[];
  pdfUrl?: string;
  originalFormat?: string;
  video_url?: string;
  app_link?: string;
  app_name?: string;
}

// Helper function to get correct MIME type for video
function getVideoMimeType(url: string): string {
  if (!url) return 'video/mp4';
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.endsWith('.webm')) return 'video/webm';
  if (lowerUrl.endsWith('.mp4') || lowerUrl.includes('mp4')) return 'video/mp4';
  if (lowerUrl.endsWith('.ogg')) return 'video/ogg';
  if (lowerUrl.endsWith('.mov')) return 'video/quicktime';
  if (lowerUrl.endsWith('.avi')) return 'video/x-msvideo';
  if (lowerUrl.endsWith('.mkv')) return 'video/x-matroska';
  
  return 'video/mp4';
}

export function Lessons() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setUserCourseTree } = useCourseTreeStore();
  const pageCache = usePageCache();
  const [searchParams] = useSearchParams();
  const requestedUnitId = searchParams.get('unit');
  const requestedLessonId = searchParams.get('lesson');
  const CACHE_KEY = `lessons-data:${user?.id ?? 'anon'}`;

  const [units, setUnits] = useState<Unit[]>(() => {
    const cached = pageCache.get<{ units: Unit[]; lessons: Lesson[] }>(CACHE_KEY);
    return cached.data?.units ?? [];
  });
  const [lessons, setLessons] = useState<Lesson[]>(() => {
    const cached = pageCache.get<{ units: Unit[]; lessons: Lesson[] }>(CACHE_KEY);
    return cached.data?.lessons ?? [];
  });
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => {
    const cached = pageCache.get<{ units: Unit[]; lessons: Lesson[] }>(CACHE_KEY);
    return cached.data === null;
  });

  useEffect(() => {
    const cached = pageCache.get<{ units: Unit[]; lessons: Lesson[] }>(CACHE_KEY);
    if (cached.fresh) { setLoading(false); return; }
    loadData(cached.data !== null);
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;

    // 1. If a specific lesson was requested
    if (requestedLessonId) {
      const found = lessons.find((l) => l.id === requestedLessonId);
      if (found) {
        setActiveLessonId(found.id);
        return;
      }
    }

    // 2. If a specific unit was requested
    if (requestedUnitId) {
      const unitLessons = lessons.filter((l) => l.unitId === requestedUnitId);
      if (unitLessons.length > 0) {
        // Proceed to the latest uploaded lesson in this unit
        const latestLesson = [...unitLessons].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0] || unitLessons[unitLessons.length - 1];
        setActiveLessonId(latestLesson.id);
      } else {
        // Unit has no lessons
        setActiveLessonId(null);
      }
      return;
    }

    // 3. General /lessons - select latest uploaded lesson
    if (lessons.length > 0) {
      const latestLesson = [...lessons].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0] || lessons[0];
      setActiveLessonId(latestLesson.id);
    } else {
      setActiveLessonId(null);
    }
  }, [requestedUnitId, requestedLessonId, units, lessons, loading]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const unitsResponse = await authFetch('/units');
      const unitsData = await unitsResponse.json();

      const allUnits: Unit[] = unitsData.success ? (unitsData.data || []) : [];
      const unitList = allUnits.filter((unit) =>
        (!unit.yearLevel && !unit.section) ||
        (unit.yearLevel === user?.year_level && unit.section?.toLowerCase() === user?.section?.toLowerCase())
      );
      setUnits(unitList);

      const lessonResults = await Promise.all(unitList.map(async (unit) => {
        const lessonsResponse = await authFetch(`/units/${unit.id}/lessons`);
        const lessonsData = await lessonsResponse.json();
        const unitLessons = lessonsData.success ? lessonsData.data || [] : [];
        return unitLessons.map((lesson: any) => ({ ...lesson, unitId: unit.id }));
      }));
      const allLessons: Lesson[] = lessonResults.flat();
      setLessons(allLessons);

      // Save to cache
      pageCache.set(CACHE_KEY, { units: unitList, lessons: allLessons });

      // Sync with global course tree store and refresh sidebar
      if (user?.id) {
        setUserCourseTree(user.id, {
          units: unitList,
          lessons: allLessons as any,
          loadedAt: Date.now(),
        });
        window.dispatchEvent(new CustomEvent('aether-course-outline-refresh', {
          detail: { userId: user.id },
        }));
      }
    } catch (error) {
      console.error('❌ Failed to load lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && units.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <AetherLoader label="Arranging your lessons" />
      </div>
    );
  }

  const activeLesson = lessons.find(l => l.id === activeLessonId);
  const currentUnit = units.find(u => u.id === (activeLesson?.unitId || requestedUnitId));
  const currentUnitLessons = currentUnit ? lessons.filter(l => l.unitId === currentUnit.id) : [];

  return (
    <div className="space-y-5">
      {/* Aesthetic Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/75 backdrop-blur-xl shadow-sm">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {currentUnit && (
              <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full">
                {currentUnit.title}
              </span>
            )}
            {activeLesson && (
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2.5 py-0.5 rounded-full">
                {activeLesson.pdf_url || activeLesson.pdfUrl ? 'PDF Document' : 'Interactive Presentation'}
              </span>
            )}
            {activeLesson?.createdAt && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                • Added {new Date(activeLesson.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {activeLesson ? activeLesson.title : 'Course Lessons'}
          </h1>

          {user?.year_level && user.section && (
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
              Year {user.year_level} • Section {user.section}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => navigate('/quizzes')}
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 rounded-xl"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            <span>Quizzes</span>
          </Button>

          <Button
            onClick={() => navigate('/laboratories')}
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 rounded-xl"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
            <span>Laboratories</span>
          </Button>

          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 rounded-xl"
            title="Refresh learning materials"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeLesson ? (
        <div className="space-y-4">
          {/* Slide & Document Viewer with Media Tabs, Comments and Completion */}
          <SlideViewer lessonId={activeLesson.id} lessonTitle={activeLesson.title} lesson={activeLesson} />
        </div>
      ) : (() => {
        // When no active lesson is selected:
        if (currentUnit && currentUnitLessons.length === 0) {
          return (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BookOpen className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">No lessons available in {currentUnit.title}</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                  There are no lessons uploaded for this unit yet. Please check back later.
                </p>
              </div>
            </div>
          );
        }

        if (lessons.length === 0 && units.length > 0) {
          return (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <BookOpen className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">No lessons available yet</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                  Learning materials will appear here once your instructor uploads them.
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-4 shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">No units and lessons available</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                There are currently no units and lessons available. Please check back later.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
