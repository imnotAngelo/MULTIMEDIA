import { Fragment, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePageCache } from '@/stores/pageCacheStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  ChevronDown,
  Calendar,
  Users,
  RefreshCw,
  ClipboardList,
  Loader2,
  Download,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AetherLoader } from '@/components/AetherLoader';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  quiz_category?: string;
  status?: string;
}

interface QuizSubmission {
  id: string;
  score: number | null;
  status: string;
  submitted_at: string;
  student?: {
    full_name?: string;
    email?: string;
    section?: string | null;
    teaching_sections?: string[] | null;
  } | null;
}

interface QuizStats {
  totalQuizzes: number;
  totalSubmissions: number;
}

interface StudentQuizResult {
  quizId: string;
  score: number | null;
  status: 'Finished' | 'Not Taken';
  submittedAt: string;
}

interface StudentScore {
  id: string;
  studentName: string;
  studentEmail: string;
  section: string;
  results: Record<string, StudentQuizResult>;
}

export function QuizManagement() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const pageCache = usePageCache();
  const CACHE_KEY = `quiz-management:${user?.id ?? 'anon'}`;

  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    const cached = pageCache.get<{ quizzes: Quiz[]; stats: QuizStats }>(CACHE_KEY);
    return cached.data?.quizzes ?? [];
  });
  const [stats, setStats] = useState<QuizStats>(() => {
    const cached = pageCache.get<{ quizzes: Quiz[]; stats: QuizStats }>(CACHE_KEY);
    return cached.data?.stats ?? { totalQuizzes: 0, totalSubmissions: 0 };
  });
  const [loading, setLoading] = useState(() => {
    const cached = pageCache.get<{ quizzes: Quiz[]; stats: QuizStats }>(CACHE_KEY);
    return cached.data === null;
  });
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, QuizSubmission[]>>({});
  const [submissionsLoading, setSubmissionsLoading] = useState<string | null>(null);
  const [studentScores, setStudentScores] = useState<StudentScore[]>([]);
  const [studentScoresLoading, setStudentScoresLoading] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const showQuizResult = location.hash === '#quiz-result';

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('Not logged in. Please log in to view quizzes.');
      setLoading(false);
      return;
    }
    const cached = pageCache.get<{ quizzes: Quiz[]; stats: QuizStats }>(CACHE_KEY);
    if (cached.fresh) {
      setLoading(false);
      if (showQuizResult) {
        void loadAllStudentScores(cached.data?.quizzes ?? []);
      }
      return;
    }
    loadQuizzes(cached.data !== null);
  }, [user?.id, location.hash]);

  const loadQuizzes = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const response = await authFetch('/assessments/instructor/all');

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
        const quizList = data.data
          .filter((a: any) => a.type === 'quiz')
          .map((a: any) => ({
            ...a,
            dueDate: a.dueDate || a.due_date || '',
            totalPoints: a.totalPoints ?? a.total_points ?? 0,
            createdAt: a.createdAt || a.created_at || '',
            updatedAt: a.updatedAt || a.updated_at || '',
          }));
        setQuizzes(quizList);
        calculateStats(quizList, true); // pass true to also save to cache
        if (showQuizResult) {
          void loadAllStudentScores(quizList);
        }
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

  const loadAllStudentScores = async (quizList: Quiz[]) => {
    setStudentScoresLoading(true);
    try {
      const resultQuizzes = quizList.filter((quiz) => quiz.status !== 'archived' && quiz.status !== 'draft');
      let students: any[] = [];
      try {
        const studentsResponse = await authFetch('/instructor/handled-students');
        const studentsData = await studentsResponse.json();
        if (studentsResponse.ok && studentsData.success && Array.isArray(studentsData.data)) {
          students = studentsData.data;
        }
      } catch {
        // Use submitted students when the handled-students endpoint is unavailable.
      }

      const submissionGroups = await Promise.all(
        resultQuizzes.map(async (quiz) => {
          try {
            const response = await authFetch(`/assessments/${quiz.id}/submissions`);
            const data = await response.json();
            if (!response.ok || !data.success || !Array.isArray(data.data)) return [];
            return data.data.map((submission: QuizSubmission) => ({ quiz, submission }));
          } catch {
            return [];
          }
        })
      );

      const studentMap = new Map<string, StudentScore>();
      const addStudent = (id: string, student: any, submission?: QuizSubmission) => {
        if (!id) return;
        if (!studentMap.has(id)) {
          const section = student?.section?.trim()
            || student?.teaching_sections?.find((item: string) => item?.trim())?.trim()
            || (submission ? getSubmissionSection(submission) : 'Unassigned');
          studentMap.set(id, {
            id,
            studentName: student?.full_name || submission?.student?.full_name || 'Unknown student',
            studentEmail: student?.email || submission?.student?.email || 'No email',
            section,
            results: {},
          });
        }
      };

      students.forEach((student) => addStudent(student.id, student));
      submissionGroups.flat().forEach(({ quiz, submission }) => {
        const studentId = (submission as any).student?.id || (submission as any).user_id;
        addStudent(studentId, (submission as any).student, submission);
        const studentScore = studentMap.get(studentId);
        if (studentScore) {
          studentScore.results[quiz.id] = {
            quizId: quiz.id,
            score: submission.score,
            status: 'Finished',
            submittedAt: submission.submitted_at || '',
          };
        }
      });

      const results = [...studentMap.values()].map((student) => ({
        ...student,
        results: Object.fromEntries(
          resultQuizzes.map((quiz) => [
            quiz.id,
            student.results[quiz.id] || {
              quizId: quiz.id,
              score: null,
              status: 'Not Taken' as const,
              submittedAt: '',
            },
          ])
        ),
      }));

      setStudentScores(
        results.sort((first, second) => first.studentName.localeCompare(second.studentName))
      );
    } finally {
      setStudentScoresLoading(false);
    }
  };

  const calculateStats = (quizList: Quiz[], saveToCache = false) => {
    const totalSubmissions = quizList.reduce((sum, q) => sum + q.submissions, 0);

    const newStats: QuizStats = {
      totalQuizzes: quizList.length,
      totalSubmissions,
    };

    setStats(newStats);
    if (saveToCache) {
      pageCache.set(CACHE_KEY, { quizzes: quizList, stats: newStats });
    }
  };

  const handleCreateQuiz = () => {
    navigate('/instructor/quiz/create');
  };

  const handleToggleVisibility = async (quiz: Quiz) => {
    const nextStatus = quiz.status === 'published' ? 'draft' : 'published';
    try {
      const response = await authFetch(`/assessments/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update exam visibility');
      }
      setQuizzes((current) => current.map((item) => item.id === quiz.id ? { ...item, status: nextStatus } : item));
      toast.success(nextStatus === 'published' ? 'Students can now view this exam.' : 'Exam is now private.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update exam visibility');
    }
  };

  const handleConfirmDelete = async () => {
    if (!quizToDelete) return;

    try {
      setIsDeleting(true);
      const response = await authFetch(`/assessments/${quizToDelete.id}`, {
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
        toast.success(`"${quizToDelete.title}" deleted successfully`);
        setQuizToDelete(null);
        pageCache.invalidate(CACHE_KEY);
        loadQuizzes(false);
      } else {
        toast.error('Failed to delete quiz');
      }
    } catch {
      toast.error('Error deleting quiz');
    } finally {
      setIsDeleting(false);
    }
  };

  const daysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    if (!Number.isFinite(diffTime)) return null;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const loadSubmissions = async (quizId: string) => {
    setSubmissionsLoading(quizId);
    try {
      const response = await authFetch(`/assessments/${quizId}/submissions`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Could not load submissions');
      }
      setSubmissions((current) => ({ ...current, [quizId]: data.data || [] }));
    } catch (submissionError: any) {
      toast.error(submissionError?.message || 'Could not load submissions');
    } finally {
      setSubmissionsLoading(null);
    }
  };

  const toggleQuiz = (quizId: string) => {
    const willExpand = expandedId !== quizId;
    setExpandedId(willExpand ? quizId : null);
    if (willExpand && !submissions[quizId]) {
      loadSubmissions(quizId);
    }
  };

  const getSubmissionSection = (submission: QuizSubmission) => {
    const student = submission.student;
    const directSection = student?.section?.trim();
    if (directSection) return directSection;
    const legacySection = student?.teaching_sections?.find((section) => section?.trim())?.trim();
    return legacySection || 'Unassigned';
  };

  const getQuizStatus = (quiz: Quiz) => {
    const diff = daysUntilDue(quiz.dueDate);

    if (!quiz.dueDate) {
      return { label: 'No due date', tone: 'bg-slate-700/60 text-slate-200 border-slate-600' };
    }

    if (diff === null) {
      return { label: 'No due date', tone: 'bg-slate-700/60 text-slate-200 border-slate-600' };
    }

    if (diff < 0) {
      return {
        label: `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`,
        tone: 'bg-red-500/10 text-red-300 border-red-500/30',
      };
    }

    if (diff === 0) {
      return { label: 'Due today', tone: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
    }

    if (diff <= 3) {
      return { label: `Due in ${diff} day${diff === 1 ? '' : 's'}`, tone: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
    }

    return { label: `Due in ${diff} days`, tone: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
  };

  const groupSubmissionsBySection = (quizId: string) => {
    const groups = new Map<string, QuizSubmission[]>();
    for (const submission of submissions[quizId] || []) {
      const section = getSubmissionSection(submission);
      const sectionSubmissions = groups.get(section) || [];
      sectionSubmissions.push(submission);
      groups.set(section, sectionSubmissions);
    }
    return [...groups.entries()];
  };

  const resultQuizzes = quizzes.filter((quiz) => quiz.status !== 'archived' && quiz.status !== 'draft');

  const exportSection = (section: string, sectionStudents: StudentScore[]) => {
    const escapeCsv = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['Student', 'Email', 'Section', ...resultQuizzes.map((quiz) => quiz.title)];
    const rows = sectionStudents.map((student) => [
      student.studentName,
      student.studentEmail,
      section,
      ...resultQuizzes.map((quiz) => {
        const result = student.results[quiz.id];
        return result?.status === 'Finished'
          ? `${result.score ?? 'Not graded'} - Finished`
          : 'Not Taken';
      }),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quiz-results-${section.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unassigned'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderStudentScores = () => {
    const sectionGroups = Array.from(
      studentScores.reduce((groups, student) => {
        const sectionStudents = groups.get(student.section) || [];
        sectionStudents.push(student);
        groups.set(student.section, sectionStudents);
        return groups;
      }, new Map<string, StudentScore[]>())
    );

    return (
      <div id="quiz-result" className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white">Quiz Result</h2>
          <p className="text-xs text-slate-500 mt-1">Scores from every quiz submission</p>
        </div>

        {studentScoresLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-8 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading student scores...
          </div>
        ) : studentScores.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-8 text-sm text-slate-500">
            No student scores available yet.
          </div>
        ) : (
          sectionGroups.map(([section, sectionStudents]) => (
            <div key={section} className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/60">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Section {section}</h3>
                  <p className="mt-1 text-xs text-slate-500">{sectionStudents.length} student{sectionStudents.length !== 1 ? 's' : ''}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => exportSection(section, sectionStudents)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Export Section
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      {resultQuizzes.map((quiz) => (
                        <th key={quiz.id} className="min-w-40 px-5 py-3">{quiz.title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sectionStudents.map((studentScore) => (
                      <tr key={studentScore.id} className="text-slate-300 hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-white">{studentScore.studentName}</div>
                          <div className="text-xs text-slate-500">{studentScore.studentEmail}</div>
                        </td>
                        {resultQuizzes.map((quiz) => {
                          const result = studentScore.results[quiz.id];
                          return (
                            <td key={quiz.id} className="px-5 py-3">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${result?.status === 'Finished'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-slate-600 bg-slate-800/80 text-slate-300'}`}>
                                {result?.status || 'Not Taken'}
                              </span>
                              {result?.status === 'Finished' && result.score !== null && (
                                <div className="mt-1 font-semibold text-emerald-400">{result.score}</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  if (showQuizResult) {
    return <div className="space-y-6">{renderStudentScores()}</div>;
  }

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
            onClick={() => { void loadQuizzes(); }}
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
                onClick={() => { void loadQuizzes(); }}
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
      <div className="grid grid-cols-2 gap-4">
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-violet-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5 text-violet-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalQuizzes}</div>
          <p className="text-slate-500 text-xs mt-1">Total Quizzes</p>
        </div>

        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalSubmissions}</div>
          <p className="text-slate-500 text-xs mt-1">Total Submissions</p>
        </div>
      </div>

      {loading && (
        <AetherLoader label="Calibrating your quiz library" />
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
          {quizzes.map((quiz) => {
            const status = getQuizStatus(quiz);

            return (
              <div
                key={quiz.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden hover:border-violet-500/30 transition-colors"
              >
                <button
                  onClick={() => toggleQuiz(quiz.id)}
                  className="w-full p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{quiz.title}</h3>
                        <p className="text-sm text-slate-400 mt-1">{quiz.description}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${status.tone}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex gap-4 mt-3 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                        <Users className="w-4 h-4" />
                        {quiz.submissions} submissions
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                        <Calendar className="w-4 h-4" />
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
                    {quiz.quiz_category === 'exam' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleVisibility(quiz)}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        {quiz.status === 'published' ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                        {quiz.status === 'published' ? 'Make Private' : 'Publish to Students'}
                      </Button>
                    )}

                    <div className="border-t border-slate-700 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-white">Student Submissions</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => loadSubmissions(quiz.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${submissionsLoading === quiz.id ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                      {submissionsLoading === quiz.id && !submissions[quiz.id] ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading submissions...
                        </div>
                      ) : !submissions[quiz.id]?.length ? (
                        <p className="text-sm text-slate-500 py-3">No students have submitted this quiz yet.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-700">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                              <tr>
                                <th className="px-3 py-2">Student</th>
                                <th className="px-3 py-2">Score</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Submitted</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {groupSubmissionsBySection(quiz.id).map(([section, sectionSubmissions]) => (
                                <Fragment key={section}>
                                  <tr className="bg-slate-800/60">
                                    <td colSpan={4} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                                      Section {section} · {sectionSubmissions.length} submission{sectionSubmissions.length !== 1 ? 's' : ''}
                                    </td>
                                  </tr>
                                  {sectionSubmissions.map((submission) => (
                                    <tr key={submission.id} className="text-slate-300 hover:bg-slate-800/40 transition-colors">
                                      <td className="px-3 py-3">
                                        <div className="font-medium text-white">{submission.student?.full_name || 'Unknown student'}</div>
                                        <div className="text-xs text-slate-500">{submission.student?.email || 'No email'}</div>
                                      </td>
                                      <td className="px-3 py-3">
                                        {submission.score === null || submission.score === undefined ? (
                                          <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300">
                                            Not graded
                                          </span>
                                        ) : (
                                          <span className="font-semibold text-emerald-400">{submission.score}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-3">
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs capitalize ${submission.status === 'submitted'
                                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                          : 'border-slate-600 bg-slate-800/80 text-slate-300'}`}>
                                          {submission.status || 'submitted'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-xs text-slate-400">
                                        {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Unknown'}
                                      </td>
                                    </tr>
                                  ))}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-slate-700">
                      {quiz.quiz_category === 'exam' && (
                        <>
                          <Button
                            onClick={() => navigate(`/instructor/exam/${quiz.id}`)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Exam
                          </Button>
                          <Button
                            onClick={() => navigate(`/instructor/exam/${quiz.id}?mode=answer-key`)}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            <KeyRound className="w-4 h-4 mr-2" />
                            Answer Key
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => setQuizToDelete(quiz)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={Boolean(quizToDelete)} onOpenChange={(open) => !open && setQuizToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="font-semibold text-slate-200">"{quizToDelete?.title}"</span>? This will permanently remove the quiz and all associated student submissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete Quiz'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
