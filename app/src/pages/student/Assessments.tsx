import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  FileText,
  ClipboardList,
  Beaker,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Calendar,
  Loader2,
} from 'lucide-react';

interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'assignment' | 'quiz' | 'laboratory';
  dueDate: string;
  status: 'pending' | 'submitted' | 'graded' | 'published' | 'draft';
  score?: number;
  maxScore?: number;
  unitId: string;
  createdAt: string;
  questions_data?: any[];
  time_limit?: number;
  shuffle_questions?: boolean;
  show_correct_answers?: boolean;
}

interface AssessmentStats {
  totalAssignments: number;
  totalQuizzes: number;
  totalLaboratories: number;
  completedAssessments: number;
  pendingAssessments: number;
  averageScore: number;
}

export function Assessments() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [stats, setStats] = useState<AssessmentStats>({
    totalAssignments: 0,
    totalQuizzes: 0,
    totalLaboratories: 0,
    completedAssessments: 0,
    pendingAssessments: 0,
    averageScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'assignment' | 'quiz' | 'laboratory'>('all');

  useEffect(() => {
    // Load assessments immediately when component mounts
    loadAssessments();

    // Set up auto-refresh polling every 5 seconds
    const refreshInterval = setInterval(() => {
      loadAssessments();
    }, 5000);

    // Cleanup interval on component unmount
    return () => clearInterval(refreshInterval);
  }, []);

  const loadAssessments = async () => {
    try {
      const response = await authFetch('http://localhost:3001/api/assessments');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const transformedAssessments = data.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          type: item.type as 'assignment' | 'quiz' | 'laboratory',
          dueDate: item.due_date || new Date().toISOString(),
          status: (item.status || 'published') as 'pending' | 'submitted' | 'graded' | 'published' | 'draft',
          score: item.score,
          maxScore: item.total_points || 100,
          unitId: item.module_id,
          createdAt: item.created_at,
          questions_data: item.questions_data,
          time_limit: item.time_limit,
          shuffle_questions: item.shuffle_questions,
          show_correct_answers: item.show_correct_answers,
        }));

        setAssessments(transformedAssessments);
        calculateStats(transformedAssessments);
      } else {
        setAssessments([]);
      }
    } catch {
      setAssessments([]);
    } finally {
      setLoading(false);
      setIsAutoRefreshing(false);
    }
  };

  const calculateStats = (assessmentList: Assessment[]) => {
    const stats: AssessmentStats = {
      totalAssignments: assessmentList.filter(a => a.type === 'assignment').length,
      totalQuizzes: assessmentList.filter(a => a.type === 'quiz').length,
      totalLaboratories: assessmentList.filter(a => a.type === 'laboratory').length,
      completedAssessments: assessmentList.filter(a => a.status !== 'pending').length,
      pendingAssessments: assessmentList.filter(a => a.status === 'pending').length,
      averageScore:
        assessmentList
          .filter(a => a.score !== undefined)
          .reduce((sum, a) => sum + (a.score || 0), 0) / assessmentList.filter(a => a.score !== undefined).length || 0,
    };

    setStats(stats);
  };

  const getAssessmentIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <FileText className="w-5 h-5" />;
      case 'quiz':
        return <ClipboardList className="w-5 h-5" />;
      case 'laboratory':
        return <Beaker className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getAssessmentColor = (type: string) => {
    switch (type) {
      case 'assignment':
        return 'text-blue-400 bg-blue-500/10';
      case 'quiz':
        return 'text-orange-400 bg-orange-500/10';
      case 'laboratory':
        return 'text-purple-400 bg-purple-500/10';
      default:
        return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'graded':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'submitted':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'published':
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return 999;
    const today = new Date();
    const due = new Date(dueDate);
    if (isNaN(due.getTime())) return 999;
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredAssessments =
    filter === 'all' ? assessments : assessments.filter(a => a.type === filter);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Assessments</h1>
          <p className="text-slate-400 mt-1 text-sm">View and complete your assignments, quizzes, and laboratories</p>
        </div>
        <div className="flex items-center gap-3">
          {isAutoRefreshing && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-400">Auto-syncing...</span>
            </div>
          )}
          <Button
            onClick={loadAssessments}
            disabled={isAutoRefreshing}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isAutoRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalAssignments}</div>
          <p className="text-slate-500 text-xs mt-1">Assignments</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalQuizzes}</div>
          <p className="text-slate-500 text-xs mt-1">Quizzes</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-purple-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Beaker className="w-4.5 h-4.5 text-purple-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalLaboratories}</div>
          <p className="text-slate-500 text-xs mt-1">Laboratories</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats.averageScore > 0 ? stats.averageScore.toFixed(1) : 'N/A'}
          </div>
          <p className="text-slate-500 text-xs mt-1">Average Score</p>
        </div>
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-emerald-500/30 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Completed</p>
              <div className="text-3xl font-bold text-emerald-400">{stats.completedAssessments}</div>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-400/50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Pending</p>
              <div className="text-3xl font-bold text-yellow-400">{stats.pendingAssessments}</div>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-400/50" />
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          All Assessments
        </button>
        <button
          onClick={() => setFilter('assignment')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            filter === 'assignment'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Assignments
        </button>
        <button
          onClick={() => setFilter('quiz')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            filter === 'quiz'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Quizzes
        </button>
        <button
          onClick={() => setFilter('laboratory')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            filter === 'laboratory'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Beaker className="w-4 h-4" />
          Laboratories
        </button>
      </div>

      {/* Assessments List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-slate-500 text-sm">Loading assessments...</p>
        </div>
      ) : (
        <>
          {filteredAssessments.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-7 h-7 text-slate-500" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No Assessments Found</h2>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                {filter === 'all'
                  ? 'No assessments available yet. Check back soon!'
                  : `No ${filter}s available yet.`}
              </p>
            </div>
          ) : (
        <div className="space-y-3">
          {filteredAssessments.map(assessment => {
            if (!assessment.id || !assessment.title) {
              return null;
            }

            try {
              const daysUntil = getDaysUntilDue(assessment.dueDate);
              const isOverdue = daysUntil < 0;
              const isDueSoon = daysUntil <= 3 && daysUntil >= 0;

              return (
              <button
                key={assessment.id}
                onClick={() => navigate(`/assessment/${assessment.id}`)}
                className="w-full group bg-gradient-to-r from-slate-900/60 to-slate-900/30 border border-slate-800 hover:border-violet-500/50 rounded-lg p-6 text-left transition-all hover:bg-slate-900/50"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left Section - Icon and Title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${getAssessmentColor(assessment.type)}`}>
                        {getAssessmentIcon(assessment.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-lg group-hover:text-violet-300 transition-colors line-clamp-1">
                          {assessment.title}
                        </h3>
                        <p className="text-slate-400 text-sm line-clamp-1">
                          {assessment.description}
                        </p>
                        {assessment.type === 'quiz' && assessment.questions_data && assessment.questions_data.length > 0 && (
                          <p className="text-xs mt-1 text-slate-500">
                            {assessment.questions_data.length} questions
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Section - Status and Score */}
                  <div className="flex items-center gap-6 ml-4 flex-shrink-0">
                    {/* Due Date */}
                    <div className="flex items-center gap-2 min-w-max">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Due</p>
                        <p
                          className={`text-sm font-medium ${
                            isOverdue
                              ? 'text-red-400'
                              : isDueSoon
                                ? 'text-yellow-400'
                                : 'text-slate-300'
                          }`}
                        >
                          {isOverdue
                            ? `${Math.abs(daysUntil)} days ago`
                            : `${daysUntil} days`}
                        </p>
                      </div>
                    </div>

                    {/* Score */}
                    {assessment.score !== undefined && (
                      <div className="text-right min-w-fit">
                        <p className="text-xs text-slate-500">Score</p>
                        <p className="text-lg font-bold text-emerald-400">
                          {assessment.score}/{assessment.maxScore || 100}
                        </p>
                      </div>
                    )}

                    {/* Status */}
                    <div className="flex items-center gap-2 min-w-fit">
                      {getStatusIcon(assessment.status)}
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Status</p>
                        <p className="text-sm font-medium text-slate-300 capitalize">
                          {assessment.status}
                        </p>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                  </div>
                </div>
              </button>
              );
            } catch {
              return (
                <div key={assessment.id} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">Error rendering assessment: {assessment.title}</p>
                </div>
              );
            }
          })}
        </div>
          )}

          {/* CTA Section */}
          {filteredAssessments.length > 0 && (
            <div className="bg-gradient-to-r from-violet-600/20 to-emerald-600/20 border border-violet-500/30 rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Stay on Track</h3>
              <p className="text-slate-400 mb-4">
                Complete your assessments on time to earn bonus XP and maintain your streak.
              </p>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
