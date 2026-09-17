import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  BookOpen,
  Users,
  FileText,
  ClipboardList,
  ArrowRight,
  Sparkles,
  Layers,
  Beaker,
  RefreshCw,
  CheckCircle2,
  Plus,
  Send,
  ExternalLink,
  ChevronRight,
  Clock,
  GraduationCap,
  FolderOpen,
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
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUnits: 0,
    totalLaboratories: 0,
    activeStudents: 0,
    totalStudents: 0,
    totalQuizzes: 0,
    lessonsCompleted: 0,
    totalSubmissions: 0,
  });

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
    loadDashboardData();
  }, [user?.id]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

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

      setStats({
        totalUnits: activeUnits.length,
        totalLaboratories: laboratoriesCreated,
        activeStudents: activeCount,
        totalStudents: handledStudentTotal,
        totalQuizzes,
        lessonsCompleted: lessonsCompletedTotal ?? fallbackCompleted,
        totalSubmissions: submissionsTotal,
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
    loadDashboardData();
    toast.success('Instructor workspace refreshed');
  };

  if (loading) {
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
              <span>Instructor Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {getGreeting()},{' '}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                {user?.full_name || 'Professor'}
              </span>
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Manage your curriculum, orchestrate AI-assisted quizzes, grade laboratory submissions, and monitor student engagement across all classes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => navigate('/instructor/quiz/create-auto')}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25 gap-2 font-medium"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Quiz Generator</span>
            </Button>

            <Button
              onClick={handleManualRefresh}
              variant="outline"
              disabled={refreshing}
              className="border-slate-700 text-slate-300 hover:bg-slate-800/60"
              title="Refresh dashboard stats"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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
          <p className="text-xs font-medium text-slate-400 mt-1">Laboratories Created</p>
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
          <p className="text-xs font-medium text-slate-400 mt-1">Total Lessons in {stats.totalUnits} Units</p>
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
          <p className="text-xs font-medium text-slate-400 mt-1">Assessments Published</p>
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
          <p className="text-xs font-medium text-slate-400 mt-1">Student Submissions</p>
        </button>
      </div>

      {/* Quick Actions Studio Hub */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 sm:p-7 shadow-xl">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <div className="w-1 h-4 bg-violet-500 rounded" />
          Instructor Studio &amp; Quick Actions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <button
            onClick={() => navigate('/instructor/quiz/create-auto')}
            className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-violet-500/50 hover:bg-violet-950/20 transition-all text-left group"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                Auto-Generate AI Quiz
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Instantly extract concepts from any lesson into structured questions.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/instructor/quiz/create-manual')}
            className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all text-left group"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Create Manual Quiz
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Write custom questions, set time limits, points, and passing scores.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/instructor/laboratories')}
            className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-all text-left group"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Beaker className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Manage Laboratories
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Assign hands-on experiments, Canva templates, and file tasks.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/instructor/courses')}
            className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-blue-500/50 hover:bg-blue-950/20 transition-all text-left group"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                Course Outline &amp; Lessons
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Upload new PPTX / PDF lessons and arrange course syllabus.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/instructor/laboratory-submissions')}
            className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-amber-500/50 hover:bg-amber-950/20 transition-all text-left group"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                Grade Submissions
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Review student portfolio work and assign scores with feedback.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/instructor/announcements')}
            className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-pink-500/50 hover:bg-pink-950/20 transition-all text-left group"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-pink-600/20 text-pink-400 border border-pink-500/30">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-pink-300 transition-colors">
                Class Announcements
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Broadcast reminders, schedules, and guidance to all sections.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Two-Column Section: Units & Lessons + Handled Students */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Units & Lessons List */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-400" />
                Active Curriculum Units &amp; Lessons
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Quick access to view slides and presentation materials</p>
            </div>
            <Button
              onClick={() => navigate('/instructor/courses')}
              size="sm"
              variant="ghost"
              className="text-xs text-violet-400 hover:text-violet-300 gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {units.length === 0 ? (
            <div className="text-center py-10">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-slate-400 font-medium">No course units created yet</p>
              <Button
                onClick={() => navigate('/instructor/courses')}
                size="sm"
                className="mt-3 bg-violet-600 hover:bg-violet-700 text-white text-xs"
              >
                Go to Course Outline
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {units.slice(0, 5).map((unit) => {
                const unitLessons = lessons.filter((l) => l.unitId === unit.id);
                return (
                  <div
                    key={unit.id}
                    className="p-4 rounded-2xl border border-slate-800/90 bg-slate-900/70 hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 text-xs font-bold border border-violet-500/20">
                          {unit.title.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{unit.title}</h4>
                          <span className="text-[11px] text-slate-400">{unitLessons.length} lessons attached</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate('/instructor/courses')}
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Manage
                      </Button>
                    </div>

                    {unitLessons.length > 0 && (
                      <div className="space-y-1.5 pl-2 border-l border-slate-800">
                        {unitLessons.slice(0, 3).map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 hover:bg-slate-950/80 transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="text-[11px] text-slate-300 font-medium truncate">{lesson.title}</span>
                              {lesson.slideCount ? (
                                <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                                  {lesson.slideCount} slides
                                </span>
                              ) : null}
                            </div>
                            <Button
                              onClick={() => navigate(`/instructor/lesson/${unit.id}/${lesson.id}`)}
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-cyan-400 hover:text-cyan-300 px-2 flex-shrink-0"
                            >
                              Present
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Handled Students Roster Card */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Handled Students
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.totalStudents} enrolled • {stats.activeStudents} active
              </p>
            </div>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" title="Active" />
          </div>

          {students.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-slate-400">No student accounts assigned yet</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {students.slice(0, 8).map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-xs border border-emerald-500/20">
                      {student.full_name?.charAt(0) || student.email?.charAt(0) || 'S'}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-white truncate">{student.full_name || 'Student'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{student.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    Enrolled
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => navigate('/instructor/laboratory-submissions')}
            variant="outline"
            className="w-full border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
          >
            Review Student Lab Work
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}