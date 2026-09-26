import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePageCache } from '@/stores/pageCacheStore';
import {
  BookOpen,
  Users,
  FileText,
  ClipboardList,
  ArrowRight,
  Layers,
  Beaker,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '@/lib/authFetch';
import { AetherLoader } from '@/components/AetherLoader';
import { toast } from 'sonner';

interface Unit {
  id: string;
  title: string;
  description: string;
  lessonCount?: number;
  createdAt: string;
}

interface Lesson {
  id: string;
  unitId: string;
  title: string;
  content: string;
  createdAt: string;
  slideCount?: number;
  slides?: any[];
}

interface ActiveStudent {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  last_active?: string | null;
  created_at?: string;
}

export function InstructorDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const pageCache = usePageCache();
  const CACHE_KEY = `instructor-dashboard:${user?.id ?? 'anon'}`;

  // Hydrate from cache on mount so the page is instant on revisit
  const cachedPayload = pageCache.get<{
    units: Unit[]; lessons: Lesson[]; students: ActiveStudent[];
    stats: typeof defaultStats;
  }>(CACHE_KEY);

  const defaultStats = {
    totalUnits: 0, totalLaboratories: 0, activeStudents: 0,
    totalStudents: 0, totalQuizzes: 0, lessonsCompleted: 0, totalSubmissions: 0,
  };

  const [units, setUnits] = useState<Unit[]>(cachedPayload.data?.units ?? []);
  const [lessons, setLessons] = useState<Lesson[]>(cachedPayload.data?.lessons ?? []);
  const [students, setStudents] = useState<ActiveStudent[]>(cachedPayload.data?.students ?? []);
  const [loading, setLoading] = useState(cachedPayload.data === null); // no spinner if cached
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(cachedPayload.data?.stats ?? defaultStats);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    if (!user?.id) {
      setUnits([]);
      setLessons([]);
      setStudents([]);
      setLoading(false);
      return;
    }
    const cached = pageCache.get(CACHE_KEY);
    if (cached.fresh) {
      setLoading(false);
      return;
    }
    // Fetch silently if we already have cached data to show
    loadDashboardData(cached.data !== null);
  }, [user?.id]);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // Fetch units
      const unitsResponse = await authFetch('/units', { cache: 'no-store' });
      const unitsData = await unitsResponse.json();
      const activeUnits: Unit[] = unitsData.success ? (unitsData.data || []) : [];
      setUnits(activeUnits);

      // Fetch laboratories
      let laboratoriesCreated = 0;
      try {
        const laboratoriesResponse = await authFetch('/laboratories/metadata', { cache: 'no-store' });
        const laboratoriesData = await laboratoriesResponse.json();
        if (laboratoriesResponse.ok && laboratoriesData?.success && Array.isArray(laboratoriesData.data)) {
          laboratoriesCreated = laboratoriesData.data.length;
        }
      } catch (err) {
        console.error('Failed to load laboratory count:', err);
      }

      // Fetch lessons from all units in parallel
      const lessonResponses = await Promise.all(
        activeUnits.map((unit) =>
          authFetch(`/units/${unit.id}/lessons`)
            .then((res) => res.json())
            .catch(() => ({ success: false, data: [] }))
        )
      );

      const allLessons: Lesson[] = [];
      lessonResponses.forEach((lessonsData, index) => {
        const unit = activeUnits[index];
        if (lessonsData.success) {
          const activeLessons = lessonsData.data || [];
          allLessons.push(
            ...activeLessons.map((l: any) => ({
              ...l,
              unitId: unit.id,
            }))
          );
        }
      });
      setLessons(allLessons);

      // Fetch students handled by this instructor
      let studentList: ActiveStudent[] = [];
      let activeCount = 0;
      let handledStudentTotal = 0;
      try {
        const studentsResponse = await authFetch('/users/students');
        const studentsData = await studentsResponse.json();
        if (studentsData?.success) {
          studentList = (studentsData.data?.students ?? []) as ActiveStudent[];
          activeCount = Number(studentsData.data?.active ?? 0);
          handledStudentTotal = Number(studentsData.data?.total ?? studentList.length);
        }
      } catch (err) {
        console.error('Failed to load students:', err);
      }
      setStudents(studentList);

      // Fetch submissions
      let submissionsTotal = 0;
      try {
        const subsResp = await authFetch('/users/submissions/stats');
        const subsData = await subsResp.json();
        if (subsData?.success) {
          submissionsTotal = Number(subsData.data?.total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load submission stats:', err);
      }

      // Fetch total quizzes
      let totalQuizzes = 0;
      try {
        const quizzesResponse = await authFetch('/assessments/instructor/all?filter=quiz&limit=100');
        const quizzesData = await quizzesResponse.json();
        if (quizzesResponse.ok && quizzesData?.success && Array.isArray(quizzesData.data)) {
          totalQuizzes = quizzesData.data.filter((assessment: any) => assessment?.type === 'quiz').length;
        }
      } catch (err) {
        console.error('Failed to load quiz count:', err);
      }

      // Fetch lesson completion stats
      let lessonsCompletedTotal: number | null = null;
      try {
        const lpResp = await authFetch('/users/lesson-progress/stats');
        const lpData = await lpResp.json();
        if (lpData?.success) {
          lessonsCompletedTotal = Number(lpData.data?.totalCompletions ?? 0);
        }
      } catch (err) {
        console.error('Failed to load lesson progress stats:', err);
      }

      const fallbackCompleted = allLessons.filter(
        (l) => (l.slides && l.slides.length > 0) || (l.slideCount && l.slideCount > 0)
      ).length;

      const newStats = {
        totalUnits: activeUnits.length,
        totalLaboratories: laboratoriesCreated,
        activeStudents: activeCount,
        totalStudents: handledStudentTotal,
        totalQuizzes,
        lessonsCompleted: lessonsCompletedTotal ?? fallbackCompleted,
        totalSubmissions: submissionsTotal,
      };
      setStats(newStats);
      // Save to cache for instant display on next visit
      pageCache.set(CACHE_KEY, {
        units: activeUnits,
        lessons: allLessons,
        students: studentList,
        stats: newStats,
      });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    pageCache.invalidate(CACHE_KEY); // force fresh fetch
    loadDashboardData();
    toast.success('Instructor workspace refreshed');
  };

  if (loading && units.length === 0) {
    return <AetherLoader label="Organizing your instructor command center" />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-slate-900/80 to-slate-900/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Instructor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {getGreeting()},{' '}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                {user?.full_name || 'Professor'}
              </span>
            </h1>
          
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
          </div>
        </div>

        {/* Decorative ambient gradient backdrop glow */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-cyan-600/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <button
          onClick={() => navigate('/instructor/laboratories')}
          className="group text-left rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-violet-500/40 hover:bg-slate-900/90 shadow-md cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 transition-colors">
              <Beaker className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
              Labs
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{stats.totalLaboratories}</div>
          <p className="text-xs font-medium text-slate-400 mt-1">Laboratories</p>
        </button>

        <button
          onClick={() => navigate('/instructor/courses')}
          className="group text-left rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/40 hover:bg-slate-900/90 shadow-md cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
              Lessons
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{lessons.length}</div>
          <p className="text-xs font-medium text-slate-400 mt-1">Lessons in {stats.totalUnits} units</p>
        </button>

        <button
          onClick={() => navigate('/instructor/quizzes')}
          className="group text-left rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-slate-900/90 shadow-md cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
              Quizzes
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{stats.totalQuizzes}</div>
          <p className="text-xs font-medium text-slate-400 mt-1">Published quizzes</p>
        </button>

        <button
          onClick={() => navigate('/instructor/laboratory-submissions')}
          className="group text-left rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/40 hover:bg-slate-900/90 shadow-md cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <ClipboardList className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Submissions
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{stats.totalSubmissions}</div>
          <p className="text-xs font-medium text-slate-400 mt-1">Submissions</p>
        </button>
      </div>

    </div>
  );
}