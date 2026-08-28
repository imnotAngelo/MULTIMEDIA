import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Calendar,
  Loader2,
  Zap,
  BookOpen,
  Trophy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AetherLoader } from '@/components/AetherLoader';

interface Quiz {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  due_date: string;
  total_points: number;
  time_limit?: number;
  questions_data?: any[];
  created_at: string;
  module_id?: string;
  completed?: boolean;
  submission?: {
    score: number | null;
    status?: string;
    submitted_at?: string;
  } | null;
}

export function StudentQuizzes() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authFetch('http://localhost:3001/api/assessments?filter=quiz&limit=100');

      if (!response.ok) {
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
        const quizList = data.data
          .filter((a: any) => a.type === 'quiz')
          .map((quiz: any) => {
            let localSubmission: any = null;
            if (user?.id) {
              try {
                localSubmission = JSON.parse(localStorage.getItem(`quiz-submission:${user.id}:${quiz.id}`) || 'null');
              } catch {
                localSubmission = null;
              }
            }
            const submission = Array.isArray(quiz.submission)
              ? quiz.submission[0] || localSubmission
              : quiz.submission || localSubmission;
            const savedScore = Number(submission?.score);
            const localScore = Number(localSubmission?.score);
            const normalizedSubmission = submission && localScore > 0 && savedScore <= 0
              ? { ...submission, score: localScore }
              : submission;
            return {
              ...quiz,
              submission: normalizedSubmission,
              completed: Boolean(quiz.completed || normalizedSubmission || quiz.status === 'submitted'),
            };
          });

        // Verify completion for APIs that do not include submissions in the list response.
        const quizzesWithSubmissions = await Promise.all(quizList.map(async (quiz: Quiz) => {
          if (quiz.completed) return quiz;
          try {
            const submissionResponse = await authFetch(`http://localhost:3001/api/assessments/${quiz.id}/my-submission`);
            if (!submissionResponse.ok) return quiz;
            const submissionData = await submissionResponse.json();
            const submission = submissionData?.data || null;
            return submission ? { ...quiz, completed: true, submission } : quiz;
          } catch {
            return quiz;
          }
        }));

        setQuizzes(quizzesWithSubmissions);
      } else {
        setQuizzes([]);
      }
    } catch (err) {
      setError('Failed to load quizzes: ' + String(err));
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTakeQuiz = (quiz: Quiz) => {
    navigate(`/assessment/${quiz.id}`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysLabel = (dateStr: string) => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-400' };
    if (diff === 0) return { text: 'Due today', color: 'text-amber-400' };
    if (diff <= 3) return { text: `Due in ${diff}d`, color: 'text-amber-400' };
    return { text: `Due in ${diff}d`, color: 'text-slate-400' };
  };

  const questionCount = (quiz: Quiz) =>
    Array.isArray(quiz.questions_data) ? quiz.questions_data.length : null;

  const isSubmitted = (quiz: Quiz) => Boolean(quiz.completed || quiz.submission || quiz.status === 'submitted');
  const isCompleted = isSubmitted;

  const missedQuizzes = quizzes.filter((quiz) => {
    if (isCompleted(quiz) || !quiz.due_date) return false;
    return new Date(quiz.due_date).getTime() < Date.now();
  });
  const completedQuizzes = quizzes.filter(isCompleted);
  const missedIds = new Set(missedQuizzes.map((quiz) => quiz.id));
  const completedIds = new Set(completedQuizzes.map((quiz) => quiz.id));
  const currentQuizzes = quizzes.filter((quiz) => !missedIds.has(quiz.id) && !completedIds.has(quiz.id));
  const [showMissed, setShowMissed] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const renderQuiz = (quiz: Quiz) => {
    const daysLabel = getDaysLabel(quiz.due_date);
    const qCount = questionCount(quiz);
    const isOverdue = quiz.due_date
      ? new Date(quiz.due_date).getTime() < Date.now()
      : false;

    return (
      <div
        key={quiz.id}
        className="bg-gradient-to-r from-slate-900/60 to-slate-900/30 border border-slate-800 rounded-xl p-5 flex items-start gap-4 hover:border-violet-500/30 transition-all group"
      >
        <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-violet-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-base leading-tight mb-1">{quiz.title}</h3>
          {quiz.description && <p className="text-slate-400 text-sm line-clamp-2 mb-2">{quiz.description}</p>}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {quiz.due_date && <span className={`flex items-center gap-1 ${daysLabel?.color ?? 'text-slate-400'}`}><Calendar className="w-3.5 h-3.5" />{formatDate(quiz.due_date)}{daysLabel && <span className="ml-1 text-xs">({daysLabel.text})</span>}</span>}
            {quiz.time_limit && <span className="flex items-center gap-1 text-slate-400"><Clock className="w-3.5 h-3.5" />{quiz.time_limit} min</span>}
            {qCount !== null && <span className="flex items-center gap-1 text-slate-400"><BookOpen className="w-3.5 h-3.5" />{qCount} question{qCount !== 1 ? 's' : ''}</span>}
            {quiz.total_points > 0 && <span className="flex items-center gap-1 text-slate-400"><Trophy className="w-3.5 h-3.5" />{quiz.total_points} pts</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {isSubmitted(quiz) ? (
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3" />Completed{quiz.submission?.score !== null && quiz.submission?.score !== undefined ? ` · ${quiz.submission.score}%` : ''}</span>
          ) : isOverdue ? (
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400"><AlertCircle className="w-3 h-3" />Missed</span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3" />Open</span>
          )}
          <Button onClick={() => handleTakeQuiz(quiz)} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5">
            {isSubmitted(quiz) ? 'Review Submission' : 'Take Quiz'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Quizzes</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Quizzes assigned by your instructor
          </p>
        </div>
        <Button
          onClick={loadQuizzes}
          variant="outline"
          className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center mb-2">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white">{quizzes.length}</div>
          <p className="text-slate-500 text-xs mt-1">Total Quizzes</p>
        </div>
        <button
          type="button"
          onClick={() => setShowMissed(true)}
          aria-label="View due and missed quizzes"
          className="w-full text-left bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-red-500/40 hover:bg-slate-900/80 transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {missedQuizzes.length}
          </div>
          <p className="text-slate-500 text-xs mt-1">Due Quizzes</p>
        </button>
        <button
          type="button"
          onClick={() => setShowCompleted(true)}
          aria-label="View completed quizzes"
          className="w-full text-left bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {completedQuizzes.length}
          </div>
          <p className="text-slate-500 text-xs mt-1">Completed Quizzes</p>
        </button>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-2">
            <Trophy className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {quizzes.reduce((sum, q) => sum + (q.total_points || 0), 0)}
          </div>
          <p className="text-slate-500 text-xs mt-1">Total Points</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Quiz List */}
      {loading ? (
        <AetherLoader label="Preparing your quizzes" />
      ) : quizzes.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-7 h-7 text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Quizzes Yet</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Your instructor hasn't published any quizzes yet. Check back later!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {missedQuizzes.length > 0 && (
            <section className="space-y-3">
              <button type="button" onClick={() => setShowMissed((visible) => !visible)} className="flex w-full items-center gap-2 text-left">
                {showMissed ? <ChevronDown className="w-5 h-5 text-red-400" /> : <ChevronRight className="w-5 h-5 text-red-400" />}
                <AlertCircle className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-semibold text-white">Missed &amp; Due Quizzes</h2>
                <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs text-red-300">{missedQuizzes.length}</span>
              </button>
              {showMissed && <div className="space-y-3">{missedQuizzes.map(renderQuiz)}</div>}
            </section>
          )}
          {completedQuizzes.length > 0 && (
            <section className="space-y-3">
              <button type="button" onClick={() => setShowCompleted((visible) => !visible)} className="flex w-full items-center gap-2 text-left">
                {showCompleted ? <ChevronDown className="w-5 h-5 text-emerald-400" /> : <ChevronRight className="w-5 h-5 text-emerald-400" />}
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Completed Quizzes</h2>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">{completedQuizzes.length}</span>
              </button>
              {showCompleted && <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{completedQuizzes.map(renderQuiz)}</div>}
            </section>
          )}
          {currentQuizzes.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Active Quizzes</h2>
              <div className="space-y-3">{currentQuizzes.map(renderQuiz)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
