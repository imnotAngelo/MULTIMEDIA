import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  Calendar,
  Users,
  RefreshCw,
  TrendingUp,
  ClipboardList,
  Loader2,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  description: string;
  unitId: string;
  unitName: string;
  dueDate: string;
  totalPoints: number;
  submissions: number;
  graded: number;
  createdAt: string;
  updatedAt: string;
}

interface QuizStats {
  totalQuizzes: number;
  totalSubmissions: number;
  gradedSubmissions: number;
  pendingGrading: number;
  averageScore: number;
}

export function QuizManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [stats, setStats] = useState<QuizStats>({
    totalQuizzes: 0,
    totalSubmissions: 0,
    gradedSubmissions: 0,
    pendingGrading: 0,
    averageScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has valid token before loading
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('Not logged in. Please log in to view quizzes.');
      setLoading(false);
      return;
    }
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      setLoading(true);

      const response = await authFetch('http://localhost:3001/api/assessments/instructor/all');

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('auth-storage');
          navigate('/login');
          return;
        }

        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        const quizList = data.data.filter((a: any) => a.type === 'quiz');
        setQuizzes(quizList);
        calculateStats(quizList);
        setError('');
      } else {
        setQuizzes([]);
      }
    } catch (error) {
      setQuizzes([]);
      setError('Failed to load quizzes: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (quizList: Quiz[]) => {
    const totalSubmissions = quizList.reduce((sum, q) => sum + q.submissions, 0);
    const gradedSubmissions = quizList.reduce((sum, q) => sum + q.graded, 0);
    
    const stats: QuizStats = {
      totalQuizzes: quizList.length,
      totalSubmissions: totalSubmissions,
      gradedSubmissions: gradedSubmissions,
      pendingGrading: totalSubmissions - gradedSubmissions,
      averageScore: totalSubmissions > 0 ? Math.round((gradedSubmissions / totalSubmissions) * 100) : 0,
    };

    setStats(stats);
  };

  const handleCreateQuiz = () => {
    navigate('/instructor/quiz/create');
  };

  const handleEditQuiz = (quizId: string) => {
    navigate(`/instructor/quiz/edit/${quizId}`);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    try {
      const response = await authFetch(`http://localhost:3001/api/assessments/${quizId}`, {
        method: 'DELETE',
      });

      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth-storage');
        navigate('/login');
        return;
      }

      if (response.ok) {
        alert('Quiz deleted successfully!');
        loadQuizzes();
      } else {
        alert('Failed to delete quiz');
      }
    } catch {
      alert('Error deleting quiz');
    }
  };

  const daysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Quiz Management</h1>
          <p className="text-slate-400 mt-1 text-sm">Create and manage student quizzes</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadQuizzes}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleCreateQuiz}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Quiz
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          {error.includes('expired') && (
            <div className="mt-3 flex gap-2">
              <Button
                onClick={loadQuizzes}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                Retry
              </Button>
              <Button
                onClick={() => {
                  localStorage.removeItem('access_token');
                  localStorage.removeItem('refresh_token');
                  localStorage.removeItem('auth-storage');
                  navigate('/login');
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white text-sm"
              >
                Log in Again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-violet-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5 text-violet-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalQuizzes}</div>
          <p className="text-slate-500 text-xs mt-1">Total Quizzes</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalSubmissions}</div>
          <p className="text-slate-500 text-xs mt-1">Total Submissions</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.gradedSubmissions}</div>
          <p className="text-slate-500 text-xs mt-1">Graded</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.pendingGrading}</div>
          <p className="text-slate-500 text-xs mt-1">Pending</p>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-slate-500 text-sm">Loading quizzes...</p>
        </div>
      )}

      {/* Quizzes List */}
      {!loading && quizzes.length === 0 && !error && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center">
          <ClipboardList className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No quizzes created yet</p>
          <Button
            onClick={handleCreateQuiz}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Quiz
          </Button>
        </div>
      )}

      {/* Quizzes Grid */}
      {!loading && quizzes.length > 0 && (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden hover:border-violet-500/30 transition-colors"
            >
              <button
                onClick={() => setExpandedId(expandedId === quiz.id ? null : quiz.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors text-left"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{quiz.title}</h3>
                  <p className="text-sm text-slate-400 mt-1">{quiz.description}</p>
                  <div className="flex gap-4 mt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                      <Users className="w-4 h-4" />
                      {quiz.submissions} submissions
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                      <Calendar className="w-4 h-4" />
                      Due in {daysUntilDue(quiz.dueDate)} days
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                      <TrendingUp className="w-4 h-4" />
                      {quiz.totalPoints} points
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${
                    expandedId === quiz.id ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {expandedId === quiz.id && (
                <div className="border-t border-slate-800 p-6 bg-slate-800/20 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Graded</p>
                      <p className="text-lg font-semibold text-emerald-400">{quiz.graded}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Pending</p>
                      <p className="text-lg font-semibold text-orange-400">
                        {quiz.submissions - quiz.graded}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Unit</p>
                      <p className="text-sm text-slate-300">{quiz.unitName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Created</p>
                      <p className="text-sm text-slate-300">
                        {new Date(quiz.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-700">
                    <Button
                      onClick={() => handleEditQuiz(quiz.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
