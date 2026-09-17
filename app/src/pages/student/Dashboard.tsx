import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Beaker,
  CheckCircle2,
  ClipboardList,
  BadgeCheck,
} from 'lucide-react';
import { AetherLoader } from '@/components/AetherLoader';

export function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalLaboratories: 0,
    completedLaboratories: 0,
    totalQuizzes: 0,
    completedQuizzes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const [laboratoriesResponse, submissionsResponse, quizzesResponse] = await Promise.all([
        authFetch('/laboratories', { cache: 'no-store' }),
        authFetch('/laboratory-submissions/my-files', { cache: 'no-store' }),
        authFetch('/assessments?filter=quiz&limit=100', { cache: 'no-store' }),
      ]);

      const laboratoriesData = await laboratoriesResponse.json();
      const submissionsData = await submissionsResponse.json();
      const quizzesData = await quizzesResponse.json();

      const laboratories = laboratoriesResponse.ok && laboratoriesData.success && Array.isArray(laboratoriesData.data)
        ? laboratoriesData.data
        : [];
      const completedLaboratories = submissionsResponse.ok && submissionsData && typeof submissionsData === 'object'
        ? Object.keys(submissionsData).length
        : 0;
      const quizzes = quizzesResponse.ok && quizzesData.success && Array.isArray(quizzesData.data)
        ? quizzesData.data.filter((quiz: any) => quiz.type === 'quiz')
        : [];

      const quizCompletionResults = await Promise.all(quizzes.map(async (quiz: any) => {
        if (quiz.completed || quiz.submission || quiz.status === 'submitted') return true;
        try {
          const submissionResponse = await authFetch(`/assessments/${quiz.id}/my-submission`, { cache: 'no-store' });
          const submissionData = submissionResponse.ok ? await submissionResponse.json() : null;
          return Boolean(submissionData?.data);
        } catch {
          return false;
        }
      }));

      setStats({
        totalLaboratories: laboratories.length,
        completedLaboratories: Math.min(completedLaboratories, laboratories.length),
        totalQuizzes: quizzes.length,
        completedQuizzes: quizCompletionResults.filter(Boolean).length,
      });
    } catch (error) {
      console.error('Failed to load dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Welcome back, <span className="gradient-text">{user?.full_name}</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Continue your multimedia learning journey
          </p>
        </div>
        <Button
          onClick={loadDashboardStats}
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white hover:bg-slate-800/50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-violet-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Beaker className="w-4.5 h-4.5 text-violet-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalLaboratories}</div>
          <p className="text-slate-500 text-xs mt-1">All Laboratories</p>
        </div>

        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.completedLaboratories}</div>
          <p className="text-slate-500 text-xs mt-1">Laboratories Completed</p>
        </div>

        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalQuizzes}</div>
          <p className="text-slate-500 text-xs mt-1">All Quizzes</p>
        </div>

        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <BadgeCheck className="w-4.5 h-4.5 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.completedQuizzes}</div>
          <p className="text-slate-500 text-xs mt-1">Quizzes Completed</p>
        </div>
      </div>

      {loading && <AetherLoader label="Tuning your learning constellation" />}
    </div>
  );
}