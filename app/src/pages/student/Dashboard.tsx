import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, ArrowRight, RefreshCw, FileText, ClipboardList, Beaker, Layers, GraduationCap, Flame, Sparkles, Loader2 } from 'lucide-react';

interface Unit {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
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

export function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

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

      console.log('🎓 Total lessons loaded:', allLessons.length);
      setLessons(allLessons);
    } catch (error) {
      console.error('❌ Failed to load units and lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalLessons = lessons.length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Welcome back, <span className="gradient-text">{user?.full_name}</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Continue your multimedia learning journey</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-violet-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <GraduationCap className="w-4.5 h-4.5 text-violet-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">0</div>
          <p className="text-slate-500 text-xs mt-1">Lessons Completed</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{user?.xp_total || 0}</div>
          <p className="text-slate-500 text-xs mt-1">Total XP</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Flame className="w-4.5 h-4.5 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{user?.streak_days || 0}</div>
          <p className="text-slate-500 text-xs mt-1">Day Streak</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Layers className="w-4.5 h-4.5 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{totalLessons}</div>
          <p className="text-slate-500 text-xs mt-1">Available Lessons</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-slate-500 text-sm">Loading your content...</p>
        </div>
      ) : units.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Units Yet</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Your instructor hasn't published any units yet. Check back soon!
          </p>
        </div>
      ) : (
        <>
          {/* Available Units */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Units</h2>
              </div>
              <span className="text-xs text-slate-500 bg-slate-800/60 px-2.5 py-1 rounded-full">
                {units.length} unit{units.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {units.map(unit => (
                <button
                  key={unit.id}
                  onClick={() => navigate('/lessons')}
                  className="group bg-slate-900/50 border border-slate-800/60 hover:border-violet-500/40 rounded-xl p-5 text-left transition-all duration-200 hover:bg-slate-900/70"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/15 transition-colors">
                      <BookOpen className="w-5 h-5 text-violet-400" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors mt-1" />
                  </div>
                  <h3 className="font-medium text-white mb-1 group-hover:text-violet-300 transition-colors">
                    {unit.title}
                  </h3>
                  <p className="text-slate-500 text-sm mb-3 line-clamp-2">
                    {unit.description || 'No description available'}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3" />
                      {unit.lessonCount} lesson{unit.lessonCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      ~{Math.ceil((unit.lessonCount || 1) * 3)} min
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>


          {/* Assessment Quick Access */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Assessments</h2>
              </div>
              <Button
                onClick={() => navigate('/assessments')}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-violet-400 text-sm"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => navigate('/assessments')}
                className="group bg-slate-900/50 border border-slate-800/60 hover:border-blue-500/40 rounded-xl p-5 text-left transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <FileText className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Assignments</span>
                </div>
                <h3 className="text-white font-medium text-sm mb-1">Assignments</h3>
                <p className="text-slate-500 text-xs">Apply your learning with practical tasks</p>
              </button>

              <button
                onClick={() => navigate('/assessments')}
                className="group bg-slate-900/50 border border-slate-800/60 hover:border-amber-500/40 rounded-xl p-5 text-left transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <ClipboardList className="w-4.5 h-4.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Quizzes</span>
                </div>
                <h3 className="text-white font-medium text-sm mb-1">Quizzes</h3>
                <p className="text-slate-500 text-xs">Test your knowledge with quick assessments</p>
              </button>

              <button
                onClick={() => navigate('/assessments')}
                className="group bg-slate-900/50 border border-slate-800/60 hover:border-purple-500/40 rounded-xl p-5 text-left transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Beaker className="w-4.5 h-4.5 text-purple-400" />
                  </div>
                  <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">Labs</span>
                </div>
                <h3 className="text-white font-medium text-sm mb-1">Laboratories</h3>
                <p className="text-slate-500 text-xs">Hands-on experimental learning</p>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
