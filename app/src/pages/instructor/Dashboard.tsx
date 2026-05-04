import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Plus, BookOpen, Users, FileText, ClipboardList, Zap, ArrowRight, Layers, Upload, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '@/lib/authFetch';

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
  xp_total?: number;
  streak_days?: number;
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
  const [stats, setStats] = useState({
    totalUnits: 0,
    activeStudents: 0,
    totalStudents: 0,
    lessonsCreated: 0,
    lessonsCompleted: 0,
    totalSubmissions: 0,
  });

  useEffect(() => {
    loadUnitsAndLessons();
  }, []);

  const loadUnitsAndLessons = async () => {
    try {
      setLoading(true);
      console.log('📚 Fetching units from API...');
      
      // Fetch units from API
      const unitsResponse = await authFetch('http://localhost:3001/api/units');
      const unitsData = await unitsResponse.json();
      console.log('✅ Units fetched:', unitsData.data || []);
      
      const unitList: Unit[] = unitsData.success ? (unitsData.data || []) : [];
      setUnits(unitList);

      // Fetch all lessons from all units
      const allLessons: Lesson[] = [];
      
      for (const unit of unitList) {
        const lessonsResponse = await authFetch(`http://localhost:3001/api/units/${unit.id}/lessons`);
        const lessonsData = await lessonsResponse.json();
        
        if (lessonsData.success) {
          const lessons = lessonsData.data || [];
          console.log(`✅ Lessons for unit "${unit.title}": ${lessons.length}`);
          allLessons.push(...lessons.map((l: any) => ({
            ...l,
            unitId: unit.id,
          })));
        }
      }

      console.log('📚 Total lessons loaded:', allLessons.length);
      setLessons(allLessons);

      // Fetch students (active = last_active within last 30 days)
      let studentList: ActiveStudent[] = [];
      let activeCount = 0;
      try {
        const studentsResponse = await authFetch('http://localhost:3001/api/users/students');
        const studentsData = await studentsResponse.json();
        if (studentsData?.success) {
          studentList = (studentsData.data?.students ?? []) as ActiveStudent[];
          activeCount = Number(studentsData.data?.active ?? 0);
          console.log(`👥 Students: ${studentList.length} total, ${activeCount} active`);
        }
      } catch (err) {
        console.error('❌ Failed to load students:', err);
      }
      setStudents(studentList);

      // Fetch total submissions (canva/link + file uploads)
      let submissionsTotal = 0;
      try {
        const subsResp = await authFetch('http://localhost:3001/api/users/submissions/stats');
        const subsData = await subsResp.json();
        if (subsData?.success) {
          submissionsTotal = Number(subsData.data?.total ?? 0);
          console.log(`📥 Submissions: ${submissionsTotal} total (canva=${subsData.data?.canva}, files=${subsData.data?.files})`);
        }
      } catch (err) {
        console.error('❌ Failed to load submission stats:', err);
      }

      // Fetch lesson completion stats from backend (real student-side completions)
      let lessonsCompletedTotal: number | null = null;
      try {
        const lpResp = await authFetch('http://localhost:3001/api/users/lesson-progress/stats');
        const lpData = await lpResp.json();
        if (lpData?.success) {
          lessonsCompletedTotal = Number(lpData.data?.totalCompletions ?? 0);
          console.log(`✅ Lesson completions: ${lessonsCompletedTotal} (distinctLessons=${lpData.data?.distinctLessonsCompleted}, distinctStudents=${lpData.data?.distinctStudentsWithCompletions})`);
        }
      } catch (err) {
        console.error('❌ Failed to load lesson progress stats:', err);
      }

      // Update stats
      const fallbackCompleted = allLessons.filter(
        l => (l.slides && l.slides.length > 0) || (l.slideCount && l.slideCount > 0)
      ).length;
      setStats({
        totalUnits: unitList.length,
        activeStudents: activeCount,
        totalStudents: studentList.length,
        lessonsCreated: allLessons.length,
        lessonsCompleted: lessonsCompletedTotal ?? fallbackCompleted,
        totalSubmissions: submissionsTotal,
      });
    } catch (error) {
      console.error('❌ Failed to load units and lessons:', error);
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
          <p className="text-slate-400 mt-1 text-sm">Manage your courses, lessons, and assessments</p>
        </div>
        <Button
          onClick={loadUnitsAndLessons}
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white hover:bg-slate-800/50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-violet-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalUnits}</div>
          <p className="text-slate-500 text-xs mt-1">Total Units</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalStudents}</div>
          <p className="text-slate-500 text-xs mt-1">Total Students</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.lessonsCreated}</div>
          <p className="text-slate-500 text-xs mt-1">Lessons Created</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-green-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.lessonsCompleted}</div>
          <p className="text-slate-500 text-xs mt-1">Lessons Completed</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalSubmissions}</div>
          <p className="text-slate-500 text-xs mt-1">Submissions</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-slate-500 text-sm">Loading your content...</p>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                onClick={() => navigate('/instructor/courses')}
                className="group flex items-center gap-4 bg-slate-900/50 border border-slate-800/60 hover:border-violet-500/40 rounded-xl p-5 text-left transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/15 transition-colors shrink-0">
                  <Plus className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm group-hover:text-violet-300 transition-colors">Create Unit</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Add a new course unit</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors shrink-0" />
              </button>

              <button
                onClick={() => navigate('/instructor/courses')}
                className="group flex items-center gap-4 bg-slate-900/50 border border-slate-800/60 hover:border-blue-500/40 rounded-xl p-5 text-left transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/15 transition-colors shrink-0">
                  <Upload className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm group-hover:text-blue-300 transition-colors">Upload Lesson</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Add a PDF lesson to a unit</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors shrink-0" />
              </button>

              <button
                onClick={() => navigate('/instructor/assessments')}
                className="group flex items-center gap-4 bg-slate-900/50 border border-slate-800/60 hover:border-purple-500/40 rounded-xl p-5 text-left transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/15 transition-colors shrink-0">
                  <ClipboardList className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm group-hover:text-purple-300 transition-colors">Assessments</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Manage student assessments</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 transition-colors shrink-0" />
              </button>

              <button
                onClick={() => navigate('/instructor/quizzes')}
                className="group flex items-center gap-4 bg-slate-900/50 border border-slate-800/60 hover:border-fuchsia-500/40 rounded-xl p-5 text-left transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-lg bg-fuchsia-500/10 flex items-center justify-center group-hover:bg-fuchsia-500/15 transition-colors shrink-0">
                  <Zap className="w-5 h-5 text-fuchsia-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm group-hover:text-fuchsia-300 transition-colors">Quizzes</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Create and manage quizzes</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-fuchsia-400 transition-colors shrink-0" />
              </button>

              <button
                onClick={() => navigate('/instructor/quiz/create')}
                className="group flex items-center gap-4 bg-slate-900/50 border border-slate-800/60 hover:border-emerald-500/40 rounded-xl p-5 text-left transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/15 transition-colors shrink-0">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm group-hover:text-emerald-300 transition-colors">Create Quiz</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Manual or AI-generated</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
              </button>
            </div>
          </div>

          {/* Units Overview */}
          {units.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-semibold text-white">Your Units</h2>
                </div>
                <span className="text-xs text-slate-500 bg-slate-800/60 px-2.5 py-1 rounded-full">
                  {units.length} unit{units.length !== 1 ? 's' : ''} • {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} • {stats.lessonsCompleted} completed • {stats.activeStudents} active student{stats.activeStudents !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {units.map(unit => {
                  const unitLessons = lessons.filter(l => l.unitId === unit.id);
                  const unitCompleted = unitLessons.filter(
                    l => (l.slides && l.slides.length > 0) || (l.slideCount && l.slideCount > 0)
                  ).length;
                  const allDone = unitLessons.length > 0 && unitCompleted === unitLessons.length;
                  return (
                    <button
                      key={unit.id}
                      onClick={() => navigate('/instructor/courses')}
                      className="group bg-slate-900/50 border border-slate-800/60 hover:border-violet-500/40 rounded-xl p-5 text-left transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/15 transition-colors">
                          <BookOpen className="w-5 h-5 text-violet-400" />
                        </div>
                        {allDone ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        ) : (
                          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
                        )}
                      </div>
                      <h3 className="font-medium text-white mb-1 group-hover:text-violet-300 transition-colors">
                        {unit.title}
                      </h3>
                      <p className="text-slate-500 text-sm mb-3 line-clamp-2">
                        {unit.description || 'No description available'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{unitLessons.length} lesson{unitLessons.length !== 1 ? 's' : ''}</span>
                        {unitLessons.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            {unitCompleted} completed
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}