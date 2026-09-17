import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Beaker,
  CheckCircle2,
  ClipboardList,
  ArrowRight,
  Sparkles,
  Trophy,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';
import { AetherLoader } from '@/components/AetherLoader';

interface DashboardStats {
  totalLaboratories: number;
  completedLaboratories: number;
  totalQuizzes: number;
  completedQuizzes: number;
  totalLessons: number;
}

export function Dashboard() {
  const { user } = useAuthStore();
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>({
    totalLaboratories: 0,
    completedLaboratories: 0,
    totalQuizzes: 0,
    completedQuizzes: 0,
    totalLessons: 0,
  });
  const [loading, setLoading] = useState(true);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const [laboratoriesResponse, submissionsResponse, quizzesResponse, unitsResponse] = await Promise.all([
        authFetch('/laboratories', { cache: 'no-store' }),
        authFetch('/laboratory-submissions/my-files', { cache: 'no-store' }),
        authFetch('/assessments?filter=quiz&limit=100', { cache: 'no-store' }),
        authFetch('/units', { cache: 'no-store' }),
      ]);

      const laboratoriesData = await laboratoriesResponse.json();
      const submissionsData = await submissionsResponse.json();
      const quizzesData = await quizzesResponse.json();
      const unitsData = await unitsResponse.json();

      const laboratories =
        laboratoriesResponse.ok && laboratoriesData.success && Array.isArray(laboratoriesData.data)
          ? laboratoriesData.data
          : [];
      const completedLaboratories =
        submissionsResponse.ok && submissionsData && typeof submissionsData === 'object'
          ? Object.keys(submissionsData).length
          : 0;
      const quizzes =
        quizzesResponse.ok && quizzesData.success && Array.isArray(quizzesData.data)
          ? quizzesData.data.filter((quiz: any) => quiz.type === 'quiz')
          : [];

      const quizCompletionResults = await Promise.all(
        quizzes.map(async (quiz: any) => {
          if (quiz.completed || quiz.submission || quiz.status === 'submitted') return true;
          try {
            const submissionResponse = await authFetch(`/assessments/${quiz.id}/my-submission`, {
              cache: 'no-store',
            });
            const submissionData = submissionResponse.ok ? await submissionResponse.json() : null;
            return Boolean(submissionData?.data);
          } catch {
            return false;
          }
        })
      );

      // Estimate total lessons count from units
      const unitsList = unitsResponse.ok && Array.isArray(unitsData.data) ? unitsData.data : [];
      let totalLessonsCount = 0;
      unitsList.forEach((u: any) => {
        if (Array.isArray(u.lessons)) totalLessonsCount += u.lessons.length;
        else if (u.lessonCount) totalLessonsCount += Number(u.lessonCount) || 0;
      });

      setStats({
        totalLaboratories: laboratories.length,
        completedLaboratories: Math.min(completedLaboratories, laboratories.length),
        totalQuizzes: quizzes.length,
        completedQuizzes: quizCompletionResults.filter(Boolean).length,
        totalLessons: totalLessonsCount || 4,
      });
    } catch (error) {
      console.error('Failed to load dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall completion percentage
  const totalTasks = stats.totalLaboratories + stats.totalQuizzes;
  const completedTasks = stats.completedLaboratories + stats.completedQuizzes;
  const overallProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const cardClass = isLightMode
    ? 'bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all'
    : 'bg-slate-900/60 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all';
  const headingColor = isLightMode ? 'text-slate-900' : 'text-white';
  const mutedText = isLightMode ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Welcome Banner */}
      <div className={`p-8 rounded-3xl border relative overflow-hidden ${
        isLightMode
          ? 'bg-gradient-to-br from-violet-500/10 via-sky-500/5 to-white border-violet-200'
          : 'bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-950 border-violet-900/30'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-500 border border-violet-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Learning Portal</span>
            </div>
            <h1 className={`text-3xl font-bold tracking-tight ${headingColor}`}>
              {getGreeting()}, <span className="bg-gradient-to-r from-violet-500 to-sky-500 bg-clip-text text-transparent">{user?.full_name}</span>!
            </h1>
            <p className={`text-sm ${mutedText}`}>
              Welcome to your digital learning workspace. Review your lessons, explore virtual labs, and track your assessment scores.
            </p>
            {(user?.section || user?.year_level) && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                {user?.year_level && (
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    Year Level {user.year_level}
                  </span>
                )}
                {user?.section && (
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    Section {user.section}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={loadDashboardStats}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lab Progress */}
        <div
          onClick={() => navigate('/laboratories')}
          className={`${cardClass} cursor-pointer group hover:border-violet-500/40`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:scale-110 transition-transform">
              <Beaker className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500">
              Labs
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${headingColor}`}>
              {stats.completedLaboratories}
            </span>
            <span className={`text-xs ${mutedText}`}>of {stats.totalLaboratories} completed</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-violet-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${stats.totalLaboratories > 0 ? (stats.completedLaboratories / stats.totalLaboratories) * 100 : 0}%`,
              }}
            />
          </div>
          <p className={`text-xs ${mutedText} mt-2`}>Virtual Workspace Tasks</p>
        </div>

        {/* Quizzes Progress */}
        <div
          onClick={() => navigate('/quizzes')}
          className={`${cardClass} cursor-pointer group hover:border-sky-500/40`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">
              Quizzes
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${headingColor}`}>
              {stats.completedQuizzes}
            </span>
            <span className={`text-xs ${mutedText}`}>of {stats.totalQuizzes} taken</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${stats.totalQuizzes > 0 ? (stats.completedQuizzes / stats.totalQuizzes) * 100 : 0}%`,
              }}
            />
          </div>
          <p className={`text-xs ${mutedText} mt-2`}>Knowledge Checks</p>
        </div>

        {/* Overall Completion */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
              Progress
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${headingColor}`}>{overallProgressPercent}%</span>
            <span className={`text-xs ${mutedText}`}>completion rate</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${overallProgressPercent}%` }}
            />
          </div>
          <p className={`text-xs ${mutedText} mt-2`}>Total Term Performance</p>
        </div>

        {/* Achievement / Learning Status */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
              Status
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${headingColor}`}>Active Learner</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-amber-500 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>On track with curriculum</span>
          </div>
          <p className={`text-xs ${mutedText} mt-2`}>Ready for next unit</p>
        </div>
      </div>

      {/* Quick Access Action Hub */}
      <div className="space-y-4">
        <h2 className={`text-lg font-bold ${headingColor}`}>Quick Navigation Hub</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => navigate('/quizzes')}
            className={`${cardClass} cursor-pointer group hover:border-sky-500 transition-all flex items-center justify-between`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`font-bold text-base ${headingColor}`}>Assessments & Quizzes</h3>
                <p className={`text-xs ${mutedText}`}>Take quizzes and review your performance</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
          </div>

          <div
            onClick={() => navigate('/laboratories')}
            className={`${cardClass} cursor-pointer group hover:border-emerald-500 transition-all flex items-center justify-between`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <Beaker className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`font-bold text-base ${headingColor}`}>Virtual Laboratories</h3>
                <p className={`text-xs ${mutedText}`}>Complete interactive assignments and design tasks</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </div>

      {loading && <AetherLoader label="Updating your learning stats..." />}
    </div>
  );
}
export default Dashboard;