import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  BookOpen, 
  RefreshCw,
  Video,
  Link as LinkIcon,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { SlideViewer } from './SlideViewer';
import { useAuthStore } from '@/stores/authStore';
import { useCourseTreeStore } from '@/stores/courseTreeStore';
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
  const { user } = useAuthStore();
  const { setUserCourseTree } = useCourseTreeStore();
  const [searchParams] = useSearchParams();
  const requestedUnitId = searchParams.get('unit');
  const requestedLessonId = searchParams.get('lesson');

  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
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

  const loadData = async () => {
    try {
      setLoading(true);
      
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

  if (loading) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {currentUnit && (
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full">
                {currentUnit.title}
              </span>
            )}
            {activeLesson?.createdAt && (
              <span className="text-xs text-slate-500">
                Added {new Date(activeLesson.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1.5">
            {activeLesson ? activeLesson.title : 'Lessons'}
          </h1>
          {user?.year_level && user.section && (
            <p className="text-slate-400 text-xs mt-1">
              Year {user.year_level} • Section {user.section}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={loadData}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
            title="Refresh learning materials"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeLesson ? (
        <div className="space-y-6">
          {/* Media & Interactive Resources (Video & App link if attached) */}
          {(activeLesson.video_url || activeLesson.app_link) && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <div className="w-1 h-5 bg-gradient-to-b from-violet-500 to-violet-600 rounded"></div>
                Media & Learning Resources
              </h3>

              {/* Video Player */}
              {activeLesson.video_url && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/20 flex items-center justify-center border border-violet-500/30">
                      <Video className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Lesson Video</p>
                      <p className="text-xs text-slate-500">Watch and follow along with the lesson</p>
                    </div>
                  </div>
                  
                  <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 bg-black shadow-2xl">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <video
                        controls
                        className="absolute inset-0 w-full h-full"
                        controlsList="nodownload"
                        preload="metadata"
                      >
                        <source src={activeLesson.video_url} type={getVideoMimeType(activeLesson.video_url)} />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </div>
              )}

              {/* App / Tool Link */}
              {activeLesson.app_link && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                      <LinkIcon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Interactive Tool</p>
                      <p className="text-xs text-slate-500">Practice hands-on with this application</p>
                    </div>
                  </div>
                  
                  <a
                    href={activeLesson.app_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/20 hover:to-emerald-500/10 hover:border-emerald-500/50 transition-all duration-300 group shadow-lg hover:shadow-emerald-500/10"
                  >
                    <span className="text-sm font-semibold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                      {activeLesson.app_name || 'Open Interactive Tool'}
                    </span>
                    <ExternalLink className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 group-hover:translate-x-1 transition-all" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Slide & Document Viewer with Comments and Completion */}
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
