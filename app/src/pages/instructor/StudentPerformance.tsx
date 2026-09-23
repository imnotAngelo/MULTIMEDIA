import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePageCache } from '@/stores/pageCacheStore';
import {
  Users,
  Search,
  Filter,
  Download,
  RefreshCw,
  GraduationCap,
  Beaker,
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  FileText,
  Save,
  X,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AetherLoader } from '@/components/AetherLoader';
import { authFetch } from '@/lib/authFetch';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';
import { useThemeStore } from '@/stores/themeStore';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Student {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  year_level?: number;
  section?: string;
}

interface QuizRecord {
  quizId: string;
  title: string;
  score: number | null;
  possible: number | null;
  percentage: number | null;
  submittedAt: string | null;
  status: 'graded' | 'submitted' | 'missing';
}

interface LabRecord {
  submissionId?: string;
  labId: string;
  title: string;
  grade: number | null;
  feedback: string | null;
  fileName: string | null;
  fileUrl: string | null;
  submittedAt: string | null;
  status: 'reviewed' | 'approved' | 'rejected' | 'pending' | 'submitted' | 'missing';
  note?: string | null;
}

interface StudentRecord extends Student {
  quizzes: QuizRecord[];
  laboratories: LabRecord[];
  quizzesCompleted: number;
  totalQuizzesCount: number;
  quizAverage: number | null;
  labsCompleted: number;
  totalLabsCount: number;
  labAverage: number | null;
  overallAverage: number | null;
  academicStanding: 'Excellent' | 'Good Standing' | 'Needs Attention' | 'Incomplete';
}

export function StudentPerformance() {
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';
  const { user } = useAuthStore();
  const pageCache = usePageCache();
  const CACHE_KEY = `student-performance:${user?.id ?? 'anon'}`;

  const [students, setStudents] = useState<StudentRecord[]>(() => {
    const cached = pageCache.get<StudentRecord[]>(CACHE_KEY);
    return cached.data ?? [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = pageCache.get<StudentRecord[]>(CACHE_KEY);
    return cached.data === null;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedStanding, setSelectedStanding] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'quizzes' | 'laboratories'>('overview');

  // Inline Lab Grading State
  const [gradingLab, setGradingLab] = useState<LabRecord | null>(null);
  const [gradeValue, setGradeValue] = useState<number>(90);
  const [feedbackValue, setFeedbackValue] = useState<string>('');
  const [statusValue, setStatusValue] = useState<string>('reviewed');
  const [savingGrade, setSavingGrade] = useState(false);

  const loadData = async (silent = false) => {
    try {
      setError('');
      if (!silent) setLoading(true);
      // Fetch students via handled-students (fallback to student-requests)
      let studentsList: Student[] = [];
      try {
        const res = await authFetch('/instructor/handled-students');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            studentsList = json.data;
          }
        }
      } catch {
        // fallback
      }

      if (studentsList.length === 0) {
        const fallbackRes = await authFetch('/instructor/student-requests?includeAll=true');
        if (fallbackRes.ok) {
          const json = await fallbackRes.json();
          if (json.success && Array.isArray(json.data)) {
            studentsList = json.data;
          }
        }
      }

      // Fetch Quizzes, Labs, and Lab Submissions in parallel
      const [quizzesRes, labsRes, labSubmissionsRes] = await Promise.all([
        authFetch('/assessments/instructor/all?filter=quiz&limit=100'),
        authFetch('/laboratories'),
        authFetch('/laboratory-submissions/all-files', { cache: 'no-store' }),
      ]);

      const quizzesJson = quizzesRes.ok ? await quizzesRes.json() : { data: [] };
      const labsJson = labsRes.ok ? await labsRes.json() : { data: [] };
      const labSubsJson = labSubmissionsRes.ok ? await labSubmissionsRes.json() : [];

      const quizzesList = Array.isArray(quizzesJson.data) ? quizzesJson.data : [];
      const publishedQuizzes = quizzesList.filter((q: any) => q.status !== 'archived');
      const labsList = Array.isArray(labsJson.data) ? labsJson.data : Array.isArray(labsJson) ? labsJson : [];
      const labSubmissions = Array.isArray(labSubsJson) ? labSubsJson : [];

      // Fetch submissions for all published quizzes
      const quizSubmissionsByQuizId: Record<string, any[]> = {};
      await Promise.all(
        publishedQuizzes.map(async (quiz: any) => {
          try {
            const subRes = await authFetch(`/assessments/${quiz.id}/submissions`);
            if (subRes.ok) {
              const subData = await subRes.json();
              quizSubmissionsByQuizId[quiz.id] = subData.success && Array.isArray(subData.data) ? subData.data : [];
            }
          } catch {
            quizSubmissionsByQuizId[quiz.id] = [];
          }
        })
      );

      // Build consolidated record per student
      const consolidatedRecords: StudentRecord[] = studentsList.map((student) => {
        // Quizzes Record
        const studentQuizzes: QuizRecord[] = publishedQuizzes.map((quiz: any) => {
          const submissions = quizSubmissionsByQuizId[quiz.id] || [];
          const mySub = submissions.find(
            (s: any) => (s.student?.id || s.user_id) === student.id
          );

          const possiblePoints = Array.isArray(quiz.questions_data)
            ? quiz.questions_data.reduce((tot: number, q: any) => tot + (Number(q.points) || 0), 0)
            : Number(quiz.total_points) || null;

          if (!mySub) {
            return {
              quizId: quiz.id,
              title: quiz.title,
              score: null,
              possible: possiblePoints,
              percentage: null,
              submittedAt: null,
              status: 'missing',
            };
          }

          const earned = mySub.earned_points !== null && mySub.earned_points !== undefined
            ? Number(mySub.earned_points)
            : mySub.score !== null && mySub.score !== undefined && possiblePoints
              ? Math.round((Number(mySub.score) / 100) * possiblePoints * 100) / 100
              : null;

          const percentage = mySub.score !== null && mySub.score !== undefined
            ? Number(mySub.score)
            : earned !== null && possiblePoints
              ? Math.round((earned / possiblePoints) * 100)
              : null;

          return {
            quizId: quiz.id,
            title: quiz.title,
            score: earned,
            possible: possiblePoints,
            percentage,
            submittedAt: mySub.submitted_at || mySub.created_at || null,
            status: mySub.status === 'graded' ? 'graded' : 'submitted',
          };
        });

        // Laboratories Record
        const studentLabs: LabRecord[] = labsList.map((lab: any) => {
          const myLabSub = labSubmissions.find(
            (sub: any) => (sub.studentId === student.id || sub.user_id === student.id) && (sub.labId === lab.id || sub.labTitle === lab.title)
          );

          if (!myLabSub) {
            return {
              labId: lab.id,
              title: lab.title,
              grade: null,
              feedback: null,
              fileName: null,
              fileUrl: null,
              submittedAt: null,
              status: 'missing',
              note: null,
            };
          }

          const hasGrade = myLabSub.grade !== null && myLabSub.grade !== undefined;
          const savedStatus = myLabSub.status || (hasGrade ? 'reviewed' : 'pending');

          return {
            submissionId: myLabSub.id,
            labId: lab.id,
            title: lab.title,
            grade: hasGrade ? Number(myLabSub.grade) : null,
            feedback: myLabSub.feedback || null,
            fileName: myLabSub.fileName || null,
            fileUrl: myLabSub.fileUrl || null,
            submittedAt: myLabSub.submittedAt || null,
            status: hasGrade && (savedStatus === 'pending' || savedStatus === 'submitted') ? 'reviewed' : savedStatus,
            note: myLabSub.note || null,
          };
        });

        // Completed quizzes & labs calculations
        const completedQuizzes = studentQuizzes.filter((q) => q.status !== 'missing' && q.score !== null);
        const quizScores = completedQuizzes.map((q) => q.percentage).filter((p): p is number => p !== null && !isNaN(p));
        const quizAvg = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;

        const completedLabs = studentLabs.filter((l) => l.status !== 'missing' && l.grade !== null);
        const labGrades = completedLabs.map((l) => l.grade).filter((g): g is number => g !== null && !isNaN(g));
        const labAvg = labGrades.length > 0 ? Math.round(labGrades.reduce((a, b) => a + b, 0) / labGrades.length) : null;

        let overallScore: number | null = null;
        if (quizAvg !== null && labAvg !== null) {
          overallScore = Math.round((quizAvg * 0.5) + (labAvg * 0.5));
        } else if (quizAvg !== null) {
          overallScore = quizAvg;
        } else if (labAvg !== null) {
          overallScore = labAvg;
        }

        let standing: 'Excellent' | 'Good Standing' | 'Needs Attention' | 'Incomplete' = 'Incomplete';
        if (overallScore !== null) {
          if (overallScore >= 90) standing = 'Excellent';
          else if (overallScore >= 75) standing = 'Good Standing';
          else standing = 'Needs Attention';
        } else if (completedQuizzes.length === 0 && completedLabs.length === 0) {
          standing = 'Incomplete';
        }

        return {
          ...student,
          quizzes: studentQuizzes,
          laboratories: studentLabs,
          quizzesCompleted: completedQuizzes.length,
          totalQuizzesCount: publishedQuizzes.length,
          quizAverage: quizAvg,
          labsCompleted: completedLabs.length,
          totalLabsCount: labsList.length,
          labAverage: labAvg,
          overallAverage: overallScore,
          academicStanding: standing,
        };
      });

      setStudents(consolidatedRecords);
      pageCache.set(CACHE_KEY, consolidatedRecords);
    } catch (err: any) {
      console.error('Failed to load student performance ledger:', err);
      setError(err?.message || 'Failed to load student records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const cached = pageCache.get<StudentRecord[]>(CACHE_KEY);
    loadData(cached.data !== null);
  }, [user?.id]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    pageCache.invalidate(CACHE_KEY);
    loadData(false);
    toast.success('Student records refreshed');
  };

  // Section List
  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.section?.trim()) set.add(s.section.trim());
    });
    return Array.from(set).sort();
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.full_name.toLowerCase().includes(q);
        const matchesEmail = s.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      // Section
      if (selectedSection !== 'all') {
        if ((s.section?.trim() || '') !== selectedSection) return false;
      }
      // Standing
      if (selectedStanding !== 'all') {
        if (s.academicStanding !== selectedStanding) return false;
      }
      return true;
    });
  }, [students, searchQuery, selectedSection, selectedStanding]);

  // Grouped by section for cards view
  const groupedBySection = useMemo(() => {
    const groups: Record<string, StudentRecord[]> = {};
    filteredStudents.forEach((student) => {
      const sec = student.section?.trim() || 'Unassigned Section';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(student);
    });
    return groups;
  }, [filteredStudents]);

  // Executive Stats
  const stats = useMemo(() => {
    const total = students.length;
    if (total === 0) return { total: 0, avgQuiz: 0, avgLab: 0, avgOverall: 0, passRate: 0 };

    const validQuizAvgs = students.map((s) => s.quizAverage).filter((q): q is number => q !== null);
    const validLabAvgs = students.map((s) => s.labAverage).filter((l): l is number => l !== null);
    const validOverall = students.map((s) => s.overallAverage).filter((o): o is number => o !== null);

    const avgQuiz = validQuizAvgs.length > 0 ? Math.round(validQuizAvgs.reduce((a, b) => a + b, 0) / validQuizAvgs.length) : 0;
    const avgLab = validLabAvgs.length > 0 ? Math.round(validLabAvgs.reduce((a, b) => a + b, 0) / validLabAvgs.length) : 0;
    const avgOverall = validOverall.length > 0 ? Math.round(validOverall.reduce((a, b) => a + b, 0) / validOverall.length) : 0;

    const passingCount = students.filter((s) => s.overallAverage !== null && s.overallAverage >= 75).length;
    const passRate = total > 0 ? Math.round((passingCount / total) * 100) : 0;

    return { total, avgQuiz, avgLab, avgOverall, passRate };
  }, [students]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      toast.error('No student records available to export');
      return;
    }

    const headers = [
      'Student Name',
      'Email',
      'Section',
      'Level',
      'Quizzes Taken',
      'Quiz Average (%)',
      'Labs Submitted',
      'Lab Average (/100)',
      'Overall Grade (%)',
      'Academic Standing',
    ];

    const rows = filteredStudents.map((s) => [
      `"${s.full_name}"`,
      `"${s.email}"`,
      `"${s.section || 'N/A'}"`,
      s.year_level || 'N/A',
      `${s.quizzesCompleted}/${s.totalQuizzesCount}`,
      s.quizAverage !== null ? `${s.quizAverage}%` : 'N/A',
      `${s.labsCompleted}/${s.totalLabsCount}`,
      s.labAverage !== null ? `${s.labAverage}/100` : 'N/A',
      s.overallAverage !== null ? `${s.overallAverage}%` : 'N/A',
      `"${s.academicStanding}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Student_Records_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Gradebook exported successfully as CSV');
  };

  // Open Dossier Modal
  const openDossier = (student: StudentRecord, tab: 'overview' | 'quizzes' | 'laboratories' = 'overview') => {
    setSelectedStudent(student);
    setActiveModalTab(tab);
    setGradingLab(null);
  };

  // Inline Grade Submission for Laboratories
  const handleStartGrading = (lab: LabRecord) => {
    setGradingLab(lab);
    setGradeValue(lab.grade ?? 90);
    setFeedbackValue(lab.feedback || '');
    setStatusValue(
      lab.status === 'missing' || lab.status === 'pending' || String(lab.status) === 'submitted'
        ? 'reviewed'
        : lab.status
    );
  };

  const handleSaveLabGrade = async () => {
    if (!gradingLab || !gradingLab.submissionId) {
      toast.error('No file submission found to grade for this laboratory task.');
      return;
    }

    setSavingGrade(true);
    try {
      const res = await authFetch(`/laboratory-submissions/grade-file/${gradingLab.submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: gradeValue,
          feedback: feedbackValue,
          status: statusValue,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save grade');
      }

      toast.success(`Saved grade of ${gradeValue}/100 for ${gradingLab.title}`);

      // Update state locally
      setStudents((prev) =>
        prev.map((stud) => {
          if (stud.id !== selectedStudent?.id) return stud;

          const updatedLabs = stud.laboratories.map((l) =>
            l.submissionId === gradingLab.submissionId
              ? { ...l, grade: gradeValue, feedback: feedbackValue, status: statusValue as any }
              : l
          );

          const completedLabs = updatedLabs.filter((l) => l.status !== 'missing' && l.grade !== null);
          const labGrades = completedLabs.map((l) => l.grade).filter((g): g is number => g !== null);
          const newLabAvg = labGrades.length > 0 ? Math.round(labGrades.reduce((a, b) => a + b, 0) / labGrades.length) : null;

          let newOverall = stud.overallAverage;
          if (stud.quizAverage !== null && newLabAvg !== null) {
            newOverall = Math.round((stud.quizAverage * 0.5) + (newLabAvg * 0.5));
          } else if (newLabAvg !== null) {
            newOverall = newLabAvg;
          }

          const updatedStudent = {
            ...stud,
            laboratories: updatedLabs,
            labsCompleted: completedLabs.length,
            labAverage: newLabAvg,
            overallAverage: newOverall,
          };

          if (selectedStudent?.id === stud.id) {
            setSelectedStudent(updatedStudent);
          }

          return updatedStudent;
        })
      );
      pageCache.invalidate(CACHE_KEY);

      setGradingLab(null);
    } catch (e: any) {
      toast.error(e?.message || 'Error saving laboratory grade');
    } finally {
      setSavingGrade(false);
    }
  };

  const getStandingBadge = (standing: StudentRecord['academicStanding']) => {
    switch (standing) {
      case 'Excellent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Dean's List / Excellent
          </span>
        );
      case 'Good Standing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            Good Standing
          </span>
        );
      case 'Needs Attention':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Needs Attention
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Incomplete
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Header Banner */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden transition-all ${
          isLightMode
            ? 'bg-gradient-to-r from-violet-500/10 via-sky-500/5 to-white border-slate-200 shadow-sm'
            : 'bg-gradient-to-r from-violet-950/40 via-slate-900/80 to-slate-900/60 border-violet-900/30 shadow-2xl backdrop-blur-xl'
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/20">
              <span>Student Performance Ledger &amp; Records</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              All Students &amp; Records
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 font-medium"
            >
              <Download className="w-4 h-4 text-violet-500" />
              Export Gradebook (.CSV)
            </Button>

            <Button
              onClick={handleManualRefresh}
              variant="outline"
              size="sm"
              disabled={refreshing || loading}
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Ambient background glows */}
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Handled Students
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {stats.total}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across {sectionOptions.length} section(s)</p>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">
              Class Quiz Average
            </span>
          </div>
          <div className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 tracking-tight">
            {stats.avgQuiz}%
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mean assessment score</p>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-500 dark:text-teal-400">
              Class Lab Average
            </span>
          </div>
          <div className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 tracking-tight">
            {stats.avgLab} <span className="text-sm font-semibold text-slate-400">/ 100</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Evaluated lab submissions</p>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">
              Passing Rate
            </span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {stats.passRate}%
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Grade of 75% or higher</p>
        </Card>
      </div>

      {/* Filter and View Switcher Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name or email..."
              className="pl-9 bg-slate-50 dark:bg-slate-950/60 border-slate-300 dark:border-slate-800 text-sm h-9"
            />
          </div>

          {/* Section Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="all">All Sections ({students.length})</option>
              {sectionOptions.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Standing Filter */}
          <select
            value={selectedStanding}
            onChange={(e) => setSelectedStanding(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="all">All Standings</option>
            <option value="Excellent">Dean's List / Excellent (90%+)</option>
            <option value="Good Standing">Good Standing (75-89%)</option>
            <option value="Needs Attention">Needs Attention (&lt;75%)</option>
            <option value="Incomplete">Incomplete Work</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/80 p-0.5 self-end sm:self-auto">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* Main Records Display */}
      {loading ? (
        <AetherLoader label="Consolidating quiz scores and laboratory submissions..." />
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-12 text-center shadow-sm">
          <Users className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600" />
          <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">No Student Records Found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery || selectedSection !== 'all' || selectedStanding !== 'all'
              ? 'Try resetting your search query or filters to view students.'
              : 'There are no students assigned to your handled sections yet.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE / SPREADSHEET VIEW */
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Student</th>
                  <th className="py-3.5 px-4">Section</th>
                  <th className="py-3.5 px-4">Quizzes Record</th>
                  <th className="py-3.5 px-4">Laboratories Record</th>
                  <th className="py-3.5 px-4">Overall Score</th>
                  <th className="py-3.5 px-4">Standing</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => openDossier(student)}
                  >
                    {/* Student Profile */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        {student.avatar_url ? (
                          <img
                            src={student.avatar_url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full border border-violet-400/30 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 font-bold text-violet-600 dark:text-violet-300">
                            {(student.full_name || student.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-violet-500 transition-colors">
                            {student.full_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{student.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Section */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Section {student.section || 'N/A'}
                      </span>
                    </td>

                    {/* Quizzes Record */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {student.quizzesCompleted}/{student.totalQuizzesCount} taken
                          </span>
                          {student.quizAverage !== null && (
                            <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                              {student.quizAverage}%
                            </Badge>
                          )}
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{
                              width: `${student.totalQuizzesCount > 0 ? (student.quizzesCompleted / student.totalQuizzesCount) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Laboratories Record */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {student.labsCompleted}/{student.totalLabsCount} submitted
                          </span>
                          {student.labAverage !== null && (
                            <Badge variant="outline" className="text-[11px] bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20">
                              {student.labAverage}/100
                            </Badge>
                          )}
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{
                              width: `${student.totalLabsCount > 0 ? (student.labsCompleted / student.totalLabsCount) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Overall Score */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {student.overallAverage !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            {student.overallAverage}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No Grades</span>
                      )}
                    </td>

                    {/* Academic Standing */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {getStandingBadge(student.academicStanding)}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDossier(student)}
                        className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View Record
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="space-y-8">
          {Object.entries(groupedBySection).map(([section, sectionStudents]) => (
            <div key={section} className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Section {section}</h2>
                <span className="rounded-full bg-slate-200/70 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {sectionStudents.length} student{sectionStudents.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sectionStudents.map((student) => (
                  <Card
                    key={student.id}
                    onClick={() => openDossier(student)}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md hover:border-violet-500/50 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {student.avatar_url ? (
                            <img
                              src={student.avatar_url}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-full border border-violet-400/30 object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/15 font-bold text-violet-600 dark:text-violet-300">
                              {(student.full_name || student.email).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 dark:text-white truncate">
                              {student.full_name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{student.email}</p>
                          </div>
                        </div>

                        {student.overallAverage !== null ? (
                          <div className="text-right">
                            <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                              {student.overallAverage}%
                            </span>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Overall</p>
                          </div>
                        ) : null}
                      </div>

                      {/* Standing Chip */}
                      <div className="mb-4">{getStandingBadge(student.academicStanding)}</div>

                      {/* Quizzes & Labs Meters */}
                      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {/* Quizzes */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
                              <GraduationCap className="w-3.5 h-3.5 text-sky-500" /> Quizzes
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {student.quizzesCompleted}/{student.totalQuizzesCount}
                              {student.quizAverage !== null ? ` (${student.quizAverage}%)` : ''}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full"
                              style={{
                                width: `${student.totalQuizzesCount > 0 ? (student.quizzesCompleted / student.totalQuizzesCount) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Laboratories */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
                              <Beaker className="w-3.5 h-3.5 text-teal-500" /> Laboratories
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {student.labsCompleted}/{student.totalLabsCount}
                              {student.labAverage !== null ? ` (${student.labAverage}/100)` : ''}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full"
                              style={{
                                width: `${student.totalLabsCount > 0 ? (student.labsCompleted / student.totalLabsCount) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDossier(student);
                      }}
                      className="w-full mt-4 border-slate-300 dark:border-slate-800 text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-violet-500" />
                      View Academic Record
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STUDENT RECORD DOSSIER MODAL */}
      <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-7xl max-h-[96vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8 lg:p-10">
          {selectedStudent && (
            <div className="space-y-6">
              {/* Dossier Header */}
              <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 dark:border-slate-800 xl:flex-row xl:items-start xl:justify-between xl:gap-12">
                <div className="flex min-w-0 items-center gap-4">
                  {selectedStudent.avatar_url ? (
                    <img
                      src={selectedStudent.avatar_url}
                      alt=""
                      className="h-16 w-16 rounded-2xl border-2 border-violet-500/30 object-cover shadow-md"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 font-extrabold text-2xl text-white shadow-md">
                      {(selectedStudent.full_name || selectedStudent.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="break-words text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                      {selectedStudent.full_name}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedStudent.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Section {selectedStudent.section || 'N/A'}
                      </span>
                      {getStandingBadge(selectedStudent.academicStanding)}
                    </div>
                  </div>
                </div>

                {/* Score Summary Box */}
                <div className="grid w-full max-w-xl shrink-0 grid-cols-3 items-center rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/80 xl:ml-8 xl:w-auto xl:min-w-[20rem]">
                  <div className="px-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall</p>
                    <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                      {selectedStudent.overallAverage !== null ? `${selectedStudent.overallAverage}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="border-l border-slate-200 px-2 text-center dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-500">Quiz Avg</p>
                    <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400">
                      {selectedStudent.quizAverage !== null ? `${selectedStudent.quizAverage}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="border-l border-slate-200 px-2 text-center dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-teal-500">Lab Avg</p>
                    <p className="text-xl font-extrabold text-teal-600 dark:text-teal-400">
                      {selectedStudent.labAverage !== null ? `${selectedStudent.labAverage}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs for Overview, Quizzes, Laboratories */}
              <Tabs
                value={activeModalTab}
                onValueChange={(val) => setActiveModalTab(val as any)}
                className="w-full"
              >
                <TabsList className="mb-6 grid grid-cols-3 border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="quizzes">
                    Quizzes ({selectedStudent.quizzesCompleted}/{selectedStudent.totalQuizzesCount})
                  </TabsTrigger>
                  <TabsTrigger value="laboratories">
                    Laboratories ({selectedStudent.labsCompleted}/{selectedStudent.totalLabsCount})
                  </TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Quizzes Brief */}
                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <GraduationCap className="w-4 h-4 text-sky-500" /> Quizzes Completion
                        </div>
                        <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                          {selectedStudent.quizzesCompleted} of {selectedStudent.totalQuizzesCount} taken
                        </span>
                      </div>
                      <div className="space-y-2">
                        {selectedStudent.quizzes.slice(0, 4).map((q) => (
                          <div key={q.quizId} className="flex items-center justify-between text-xs py-1">
                            <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{q.title}</span>
                            {q.status !== 'missing' && q.score !== null ? (
                              <span className="font-bold text-slate-900 dark:text-white">
                                {q.score}/{q.possible} ({q.percentage}%)
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Not attempted</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setActiveModalTab('quizzes')}
                        className="p-0 h-auto text-xs text-violet-500 hover:text-violet-600 mt-3 font-semibold"
                      >
                        View all {selectedStudent.quizzes.length} quiz records &rarr;
                      </Button>
                    </Card>

                    {/* Labs Brief */}
                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <Beaker className="w-4 h-4 text-teal-500" /> Laboratories Completion
                        </div>
                        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                          {selectedStudent.labsCompleted} of {selectedStudent.totalLabsCount} submitted
                        </span>
                      </div>
                      <div className="space-y-2">
                        {selectedStudent.laboratories.slice(0, 4).map((lab) => (
                          <div key={lab.labId} className="flex items-center justify-between text-xs py-1">
                            <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{lab.title}</span>
                            {lab.status !== 'missing' ? (
                              <span className="font-bold text-slate-900 dark:text-white">
                                {lab.grade !== null ? `${lab.grade}/100` : 'Pending grade'}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Not submitted</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setActiveModalTab('laboratories')}
                        className="p-0 h-auto text-xs text-teal-500 hover:text-teal-600 mt-3 font-semibold"
                      >
                        View &amp; grade all {selectedStudent.laboratories.length} laboratory tasks &rarr;
                      </Button>
                    </Card>
                  </div>
                </TabsContent>

                {/* QUIZZES TAB */}
                <TabsContent value="quizzes" className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 uppercase">
                        <tr>
                          <th className="py-3 px-4">Quiz Title</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Raw Score</th>
                          <th className="py-3 px-4">Percentage</th>
                          <th className="py-3 px-4">Date Taken</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedStudent.quizzes.map((q) => (
                          <tr key={q.quizId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                              {q.title}
                            </td>
                            <td className="py-3 px-4">
                              {q.status !== 'missing' ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Submitted
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs">
                                  Missing
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                              {q.score !== null ? `${q.score} / ${q.possible ?? '?'}` : '—'}
                            </td>
                            <td className="py-3 px-4">
                              {q.percentage !== null ? (
                                <span className={`font-bold ${q.percentage >= 75 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                  {q.percentage}%
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">
                              {q.submittedAt ? new Date(q.submittedAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* LABORATORIES TAB */}
                <TabsContent value="laboratories" className="space-y-4">
                  {/* Inline Grading Form Box if activated */}
                  {gradingLab && (
                    <div className="p-5 rounded-2xl border-2 border-violet-500 bg-violet-500/5 space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Save className="w-4 h-4 text-violet-500" /> Grade Lab: {gradingLab.title}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Student: {selectedStudent.full_name} ({selectedStudent.email})
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setGradingLab(null)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                            Grade Score (0 - 100)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={gradeValue}
                            onChange={(e) => setGradeValue(Number(e.target.value))}
                            className="bg-white dark:bg-slate-950 text-base font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                            Evaluation Status
                          </label>
                          <select
                            value={statusValue}
                            onChange={(e) => setStatusValue(e.target.value)}
                            className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-sm font-medium"
                          >
                            <option value="reviewed">Reviewed &amp; Graded</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected / Needs Revision</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                          Instructor Feedback &amp; Rubric Notes
                        </label>
                        <textarea
                          rows={2}
                          value={feedbackValue}
                          onChange={(e) => setFeedbackValue(e.target.value)}
                          placeholder="Provide constructive feedback or remarks on the student's submission..."
                          className="w-full rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGradingLab(null)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveLabGrade}
                          disabled={savingGrade}
                          className="bg-violet-600 hover:bg-violet-500 text-white text-xs gap-1.5"
                        >
                          {savingGrade ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save &amp; Update Grade
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedStudent.laboratories.map((lab) => (
                      <div
                        key={lab.labId}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white truncate">{lab.title}</h4>
                            {lab.status !== 'missing' ? (
                              <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30 text-xs">
                                {lab.status === 'reviewed' ? 'Reviewed' : lab.status === 'approved' ? 'Approved' : 'Submitted'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs">
                                Not Submitted
                              </Badge>
                            )}
                          </div>

                          {lab.submittedAt && (
                            <p className="text-xs text-slate-400">
                              Submitted: {new Date(lab.submittedAt).toLocaleDateString()}
                            </p>
                          )}

                          {lab.fileName && (
                            <div className="flex items-center gap-2 pt-1 text-xs">
                              <span className="font-medium text-slate-500 dark:text-slate-400">File:</span>
                              <a
                                href={resolveBackendAssetUrl(lab.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 font-semibold"
                              >
                                <FileText className="w-3 h-3" />
                                {lab.fileName}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {lab.feedback && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 italic pt-1">
                              Feedback: "{lab.feedback}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <div className="text-right">
                            <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                              {lab.grade !== null ? `${lab.grade} / 100` : '—'}
                            </div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Score</p>
                          </div>

                          {lab.submissionId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartGrading(lab)}
                              className="text-xs border-violet-400/40 text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                            >
                              Grade / Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StudentPerformance;
