import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';
import {
  Save,
  Beaker,
  ImageIcon,
  FileVideo,
  Eye,
  X,
  Calendar,
  User,
  Star,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Download,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { AetherLoader } from '@/components/AetherLoader';
import { toast } from 'sonner';
import { useThemeStore } from '@/stores/themeStore';
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

interface FileSubmission {
  id: string;
  labId: string;
  labTitle: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  studentSection: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize?: number;
  note: string;
  submittedAt: string;
  grade: number | null;
  feedback: string;
  status: string;
}

interface LaboratorySummary {
  id: string;
  title: string;
}

interface StudentSummary {
  id: string;
  full_name?: string;
  email?: string;
  section?: string | null;
  teaching_sections?: string[] | null;
}

export function LaboratorySubmissions() {
  const location = useLocation();
  const showLaboratoryResults = location.hash === '#lab-results';
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';
  const surfaceClass = isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800';
  const sectionHeaderClass = isLightMode
    ? 'bg-slate-50 hover:bg-slate-100 text-slate-900'
    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-100';
  const sectionBodyClass = isLightMode ? 'bg-slate-50' : 'bg-slate-950/40';
  const nestedHeaderClass = isLightMode
    ? 'bg-white hover:bg-slate-50 text-slate-800'
    : 'bg-slate-900/90 hover:bg-slate-800/70 text-slate-200';
  const nestedBodyClass = isLightMode ? 'bg-white' : 'bg-slate-950/20';
  const submissionCardClass = isLightMode
    ? 'bg-white border-slate-200'
    : 'bg-slate-900/80 border-slate-800';
  const thumbnailClass = isLightMode ? 'bg-slate-100' : 'bg-slate-950';
  const modalPanelClass = isLightMode
    ? 'bg-white border-slate-200'
    : 'bg-slate-900 border-slate-700';
  const modalHeaderClass = isLightMode
    ? 'border-slate-200 bg-slate-50'
    : 'border-slate-800 bg-slate-950/40';
  const modalHeadingClass = isLightMode ? 'text-slate-900' : 'text-white';
  const modalMutedTextClass = isLightMode ? 'text-slate-600' : 'text-slate-400';
  const modalLabelClass = isLightMode ? 'text-slate-700' : 'text-slate-300';
  const modalFieldClass = isLightMode
    ? 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
    : 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500';

  const [error, setError] = useState<string | null>(null);

  // File submissions from instructor-assigned labs
  const [fileSubs, setFileSubs] = useState<FileSubmission[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [handledStudents, setHandledStudents] = useState<StudentSummary[]>([]);
  const [loadingFileSubs, setLoadingFileSubs] = useState(true);
  const [viewingFile, setViewingFile] = useState<FileSubmission | null>(null);
  const [gradingFile, setGradingFile] = useState<FileSubmission | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: 0, feedback: '', status: 'reviewed' });
  const [savingGrade, setSavingGrade] = useState(false);
  const [expandedLabs, setExpandedLabs] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [labResultSearchQuery, setLabResultSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded'>('all');

  // Bulk review states
  const [bulkReviewDialogOpen, setBulkReviewDialogOpen] = useState(false);
  const [bulkReviewScore, setBulkReviewScore] = useState(100);
  const [bulkReviewFeedback, setBulkReviewFeedback] = useState('Reviewed & verified. Good work!');
  const [isBulkReviewing, setIsBulkReviewing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    if (fileSubs.length === 0) return;

    Promise.all(
      fileSubs.map(async (submission) => {
        if (submission.fileType === 'link') return [submission.id, submission.fileUrl] as const;
        try {
          const response = await authFetch(resolveBackendAssetUrl(submission.fileUrl));
          if (!response.ok) return null;
          const objectUrl = URL.createObjectURL(await response.blob());
          objectUrls.push(objectUrl);
          return [submission.id, objectUrl] as const;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setPreviewUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
    });

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [fileSubs]);

  const fetchSubmissions = async () => {
    setLoadingFileSubs(true);
    try {
      const r = await authFetch('/laboratory-submissions/all-files', { cache: 'no-store' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load submissions (${r.status})`);
      }
      const rows: FileSubmission[] = await r.json();
      setFileSubs(
        rows.map((row) => ({
          ...row,
          studentSection: row.studentSection || (row as FileSubmission & { section?: string }).section || 'Unassigned',
          grade:
            row.grade === null || row.grade === undefined || (row.grade as any) === ''
              ? null
              : Number(row.grade),
          status:
            row.grade !== null && row.grade !== undefined &&
            (row.status === 'pending' || row.status === 'submitted' || !row.status)
              ? 'reviewed'
              : row.status || 'submitted',
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load file submissions');
    } finally {
      setLoadingFileSubs(false);
    }
  };

  const fetchLabsAndStudents = async () => {
    try {
      const [laboratoriesResponse, studentsResponse] = await Promise.all([
        authFetch('/laboratories', { cache: 'no-store' }),
        authFetch('/instructor/handled-students', { cache: 'no-store' }),
      ]);
      const laboratoriesData = await laboratoriesResponse.json().catch(() => ({}));
      const studentsData = await studentsResponse.json().catch(() => ({}));
      const laboratoryRows = Array.isArray(laboratoriesData?.data)
        ? laboratoriesData.data
        : Array.isArray(laboratoriesData)
          ? laboratoriesData
          : [];
      const studentRows = Array.isArray(studentsData?.data)
        ? studentsData.data
        : Array.isArray(studentsData)
          ? studentsData
          : [];
      setLaboratories(laboratoryRows.map((laboratory: any) => ({
        id: String(laboratory.id),
        title: laboratory.title || laboratory.name || `Laboratory ${laboratory.id}`,
      })));
      setHandledStudents(studentRows);
    } catch {
      // The submissions response remains usable if roster metadata is unavailable.
    }
  };

  const handleRefresh = () => {
    void fetchSubmissions();
    void fetchLabsAndStudents();
  };

  useEffect(() => {
    void fetchSubmissions();
    void fetchLabsAndStudents();
  }, []);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return fileSubs.filter((sub) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        sub.studentName?.toLowerCase().includes(q) ||
        sub.labTitle?.toLowerCase().includes(q) ||
        sub.studentSection?.toLowerCase().includes(q) ||
        sub.studentEmail?.toLowerCase().includes(q);

      const isGraded = sub.grade !== null && sub.grade !== undefined;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && !isGraded) ||
        (statusFilter === 'graded' && isGraded);

      return matchesSearch && matchesStatus;
    });
  }, [fileSubs, searchQuery, statusFilter]);

  const groupedFileSubs = useMemo(() => {
    const groups = new Map<string, Map<string, { title: string; submissions: FileSubmission[] }>>();
    for (const submission of filteredSubmissions) {
      const section = submission.studentSection || 'Unassigned';
      const sectionGroups = groups.get(section) ?? new Map();
      const existing = sectionGroups.get(submission.labId);
      if (existing) {
        existing.submissions.push(submission);
      } else {
        sectionGroups.set(submission.labId, { title: submission.labTitle, submissions: [submission] });
      }
      groups.set(section, sectionGroups);
    }
    if (showLaboratoryResults) {
      handledStudents.forEach((student) => {
        const section = student.section?.trim()
          || student.teaching_sections?.find((item) => item?.trim())?.trim()
          || 'Unassigned';
        if (!groups.has(section)) groups.set(section, new Map());
      });
    }
    return [...groups.entries()];
  }, [filteredSubmissions, handledStudents, showLaboratoryResults]);

  const hasLabResultMatches = useMemo(() => {
    if (!showLaboratoryResults) return true;
    const query = labResultSearchQuery.trim().toLowerCase();
    if (!query) return true;
    const cleanSectionQuery = query.replace(/^section\s+/i, '').trim();

    return groupedFileSubs.some(([section, labGroups]) => {
      const sectionMatches = section.toLowerCase().includes(query) || (cleanSectionQuery ? section.toLowerCase().includes(cleanSectionQuery) : false);
      if (sectionMatches) return true;

      const sectionStudents = [
        ...handledStudents.filter((student) => {
          const studentSection = student.section?.trim()
            || student.teaching_sections?.find((item) => item?.trim())?.trim()
            || 'Unassigned';
          return studentSection === section;
        }),
        ...[...labGroups.values()].flatMap((group) => group.submissions),
      ];

      return sectionStudents.some((student) => {
        const name = (student as any).full_name || (student as any).studentName || '';
        const email = (student as any).email || (student as any).studentEmail || '';
        return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
      });
    });
  }, [groupedFileSubs, handledStudents, labResultSearchQuery, showLaboratoryResults]);

  const exportSection = (
    section: string,
    labGroups: Map<string, { title: string; submissions: FileSubmission[] }>,
    students: Array<{ studentId: string; studentName: string; studentEmail: string }>
  ) => {
    const labs = [...labGroups.entries()];

    const escapeCsv = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['Student', 'Email', 'Section', ...labs.map(([, group]) => group.title)];
    const rows = students.map((student) => [
      student.studentName,
      student.studentEmail,
      section,
      ...labs.map(([labId]) => {
        const submission = labGroups.get(labId)?.submissions.find((item) => item.studentId === student.studentId);
        if (!submission) return 'Untaken';
        return submission.grade !== null && submission.grade !== undefined
          ? `${submission.grade}/100 - Finished`
          : 'Finished';
      }),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laboratory-results-${section.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unassigned'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Quick stats
  const totalCount = fileSubs.length;
  const gradedCount = fileSubs.filter((s) => s.grade !== null && s.grade !== undefined).length;
  const pendingCount = totalCount - gradedCount;

  const openGradeModal = (sub: FileSubmission) => {
    setGradeForm({
      grade: sub.grade ?? 90,
      feedback: sub.feedback ?? '',
      status: sub.status === 'submitted' ? 'reviewed' : sub.status,
    });
    setGradingFile(sub);
  };

  const applyPreset = (grade: number, feedback: string, status: string) => {
    setGradeForm({ grade, feedback, status });
  };

  const handleSaveGrade = async () => {
    if (!gradingFile) return;
    setSavingGrade(true);
    try {
      const res = await authFetch(`/laboratory-submissions/grade-file/${gradingFile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gradeForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to save grade (${res.status})`);
      }
      const savedSubmission = await res.json().catch(() => ({}));
      setFileSubs((prev) =>
        prev.map((s) =>
          s.id === gradingFile.id
            ? {
                ...s,
                grade: savedSubmission.grade !== null && savedSubmission.grade !== undefined
                  ? Number(savedSubmission.grade)
                  : gradeForm.grade,
                feedback: savedSubmission.feedback ?? gradeForm.feedback,
                status: savedSubmission.status || gradeForm.status,
              }
            : s
        )
      );
      setGradingFile(null);
      toast.success(`Graded ${gradingFile.studentName} with ${gradeForm.grade}/100`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save grade');
    } finally {
      setSavingGrade(false);
    }
  };

  const handleBulkMarkAllReviewed = async () => {
    const pending = fileSubs.filter((s) => s.grade === null || s.grade === undefined);
    if (pending.length === 0) return;
    setIsBulkReviewing(true);
    try {
      const results = await Promise.allSettled(
        pending.map((sub) =>
          authFetch(`/laboratory-submissions/grade-file/${sub.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grade: bulkReviewScore,
              feedback: bulkReviewFeedback,
              status: 'reviewed',
            }),
          })
        )
      );
      const successfulIds = new Set<string>();
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value.ok) {
          successfulIds.add(pending[idx].id);
        }
      });
      if (successfulIds.size > 0) {
        setFileSubs((prev) =>
          prev.map((s) =>
            successfulIds.has(s.id)
              ? {
                  ...s,
                  grade: bulkReviewScore,
                  feedback: bulkReviewFeedback,
                  status: 'reviewed',
                }
              : s
          )
        );
        toast.success(`Marked ${successfulIds.size} submission${successfulIds.size !== 1 ? 's' : ''} as reviewed!`);
      }
      if (successfulIds.size < pending.length) {
        toast.error(`Could not update ${pending.length - successfulIds.size} submissions`);
      }
      setBulkReviewDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to bulk review submissions');
    } finally {
      setIsBulkReviewing(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === 'approved') return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    if (s === 'rejected') return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (s === 'reviewed') return <Star className="w-3.5 h-3.5 text-amber-400" />;
    return <Clock className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {showLaboratoryResults && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                Laboratory Results
              </h1>
              <p className={`text-sm mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Detailed performance and submission scores across all laboratory activities.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className={isLightMode ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loadingFileSubs ? 'animate-spin' : ''}`} />
                Refresh Results
              </Button>
            </div>
          </div>

          {/* Search bar for Laboratory Results */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={labResultSearchQuery}
                onChange={(e) => setLabResultSearchQuery(e.target.value)}
                placeholder="Search by student name, section, or email (Gmail)..."
                className={`w-full pl-10 pr-9 py-2 text-sm rounded-xl border ${
                  isLightMode
                    ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
                    : 'border-slate-700 bg-slate-900 text-white placeholder:text-slate-500'
                } focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm`}
              />
              {labResultSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLabResultSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {labResultSearchQuery && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Searching for "<span className="font-semibold text-slate-900 dark:text-white">{labResultSearchQuery}</span>"
              </div>
            )}
          </div>
        </div>
      )}

      {!showLaboratoryResults && <>
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
            Laboratory Submissions
          </h1>
          <p className={`text-sm mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Evaluate hands-on student laboratory work, inspect uploaded media, and provide rubric feedback.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Button
              type="button"
              onClick={() => setBulkReviewDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-sm gap-1.5"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Reviewed ({pendingCount})
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className={isLightMode ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loadingFileSubs ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      </>}

      {!showLaboratoryResults && error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!showLaboratoryResults && <>
      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`${surfaceClass} p-4 sm:p-5 rounded-2xl`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Total Submissions</span>
            <Beaker className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{totalCount}</div>
          <p className={`text-[11px] mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>Across all assigned labs</p>
        </Card>

        <Card className={`${surfaceClass} p-4 sm:p-5 rounded-2xl`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">{pendingCount}</div>
          <p className={`text-[11px] mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>Awaiting instructor evaluation</p>
        </Card>

        <Card className={`${surfaceClass} p-4 sm:p-5 rounded-2xl`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Graded</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{gradedCount}</div>
          <p className={`text-[11px] mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>Reviewed with score &amp; feedback</p>
        </Card>

      </div>
      </>}

      {!showLaboratoryResults && <>
      {/* Filter and Search Bar */}
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'} border p-3.5 rounded-2xl`}>
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, lab, or section..."
            className={`w-full pl-10 pr-9 py-2 rounded-xl border text-xs sm:text-sm outline-none focus:border-violet-500 transition-all ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400' : 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500'}`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {searchQuery && (
            <span className={`text-xs mr-2 whitespace-nowrap ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Found <span className={`font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{filteredSubmissions.length}</span> results
            </span>
          )}
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-violet-600 text-white shadow-sm'
                : isLightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : isLightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('graded')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'graded'
                ? 'bg-emerald-600 text-white shadow-sm'
                : isLightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Graded ({gradedCount})
          </button>
        </div>
      </div>
      </>}

      {/* Grading Modal */}
      {gradingFile && (
        <div
          className={`fixed inset-0 ${isLightMode ? 'bg-slate-900/35' : 'bg-black/80'} z-50 flex items-center justify-center p-4 animate-in fade-in duration-150`}
          onClick={() => setGradingFile(null)}
        >
          <div
            className={`${modalPanelClass} border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${modalHeaderClass}`}>
              <div>
                <h2 className={`${modalHeadingClass} text-base font-bold`}>Grade Student Submission</h2>
                <p className={`${modalMutedTextClass} text-xs mt-0.5`}>
                  {gradingFile.studentName} · {gradingFile.labTitle}
                </p>
              </div>
              <button onClick={() => setGradingFile(null)} className={`${modalMutedTextClass} hover:${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Quick Presets */}
              <div>
                <label className={`block text-xs font-semibold ${modalMutedTextClass} uppercase tracking-wider mb-2`}>
                  Quick Grade Presets
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => applyPreset(100, 'Exemplary work! Followed all instructions with outstanding attention to detail.', 'approved')}
                    className="p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all text-center"
                  >
                    100% Exemplary
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(90, 'Great effort and execution. Well done!', 'approved')}
                    className="p-2 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-bold transition-all text-center"
                  >
                    90% Great
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(85, 'Good submission. Meets the key requirements.', 'reviewed')}
                    className="p-2 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-xs font-bold transition-all text-center"
                  >
                    85% Good
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(75, 'Passing work. Consider reviewing the lab guidelines for improvements.', 'reviewed')}
                    className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-all text-center"
                  >
                    75% Passing
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium ${modalLabelClass} mb-1.5`}>Score (0 – 100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeForm.grade}
                    onChange={(e) =>
                      setGradeForm((f) => ({ ...f, grade: Math.min(100, Math.max(0, Number(e.target.value))) }))
                    }
                    className={`${modalFieldClass} font-bold`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${modalLabelClass} mb-1.5`}>Status</label>
                  <select
                    value={gradeForm.status}
                    onChange={(e) => setGradeForm((f) => ({ ...f, status: e.target.value }))}
                    className={modalFieldClass}
                  >
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Needs Revision</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${modalLabelClass} mb-1.5`}>Rubric &amp; Student Feedback</label>
                <textarea
                  rows={3}
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))}
                  placeholder="Provide constructive feedback the student will see in their portfolio..."
                  className={`${modalFieldClass} text-xs resize-none placeholder:text-slate-400 leading-relaxed`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className={`flex-1 ${isLightMode ? 'border-slate-200 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                  onClick={() => setGradingFile(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={savingGrade}
                  onClick={handleSaveGrade}
                >
                  {savingGrade ? <AetherSpinner className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Save Evaluation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal for File Submissions */}
      {viewingFile && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setViewingFile(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <div>
                <h2 className="text-base font-bold text-white">{viewingFile.labTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Submitted by {viewingFile.studentName} ({viewingFile.studentEmail})
                </p>
              </div>
              <button onClick={() => setViewingFile(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center min-h-[220px]">
                {viewingFile.fileType === 'link' ? (
                  <a
                    href={viewingFile.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Open student submission
                  </a>
                ) : viewingFile.fileType.startsWith('video/') ? (
                  <video src={previewUrls[viewingFile.id]} controls className="w-full max-h-96 object-contain" />
                ) : (
                  <img
                    src={previewUrls[viewingFile.id]}
                    alt={viewingFile.fileName}
                    className="w-full max-h-96 object-contain"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                <span>{viewingFile.fileName} {viewingFile.fileSize ? `· ${(viewingFile.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}</span>
                <span>Submitted {new Date(viewingFile.submittedAt).toLocaleString()}</span>
              </div>

              {viewingFile.note && (
                <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Student Note</span>
                  <p className="text-xs text-slate-200 italic">"{viewingFile.note}"</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  size="sm"
                  onClick={() => {
                    setViewingFile(null);
                    openGradeModal(viewingFile);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <Star className="w-3.5 h-3.5" />
                  Evaluate &amp; Grade
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Submissions Grouped View */}
      <Card className={`${surfaceClass} p-5 rounded-3xl shadow-xl ${showLaboratoryResults ? 'p-0 bg-transparent border-0 shadow-none' : ''}`}>
        {!showLaboratoryResults && <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Beaker className="w-5 h-5 text-emerald-400" />
            Assigned Lab Files &amp; Media
          </h2>
        </div>}

        {!showLaboratoryResults && loadingFileSubs && (
          <AetherLoader variant="cards" count={3} label="Loading student lab submissions..." />
        )}

        {showLaboratoryResults && loadingFileSubs && (
          <AetherLoader variant="table" count={3} label="Loading laboratory results..." />
        )}

        {!showLaboratoryResults && !loadingFileSubs && filteredSubmissions.length === 0 && (
          <div className={`text-sm ${isLightMode ? 'text-slate-600 border-slate-200 bg-slate-50' : 'text-slate-400 border-slate-800 bg-slate-950/20'} py-12 text-center rounded-2xl border border-dashed`}>
            <Beaker className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-slate-300">No matching submissions found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filter settings.</p>
          </div>
        )}

        {showLaboratoryResults && !loadingFileSubs && !hasLabResultMatches && (
          <div className={`p-10 text-center rounded-2xl border border-dashed ${isLightMode ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-800 bg-slate-900/60 text-slate-300'}`}>
            <Search className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-sm">No laboratory results match "{labResultSearchQuery}"</p>
            <p className="text-xs text-slate-500 mt-1">Try searching by student name, section, or Gmail address.</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLabResultSearchQuery('')}
              className={`mt-4 ${isLightMode ? 'border-slate-300 text-slate-700' : 'border-slate-700 text-slate-300'}`}
            >
              Clear Search
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {groupedFileSubs.map(([section, labGroups]) => {
            const resultLabGroups = new Map(labGroups);
            laboratories.forEach((laboratory) => {
              if (!resultLabGroups.has(laboratory.id)) {
                resultLabGroups.set(laboratory.id, { title: laboratory.title, submissions: [] });
              }
            });
            const resultStudents = [
              ...new Map(
                [
                  ...handledStudents
                    .filter((student) => {
                      const studentSection = student.section?.trim()
                        || student.teaching_sections?.find((item) => item?.trim())?.trim()
                        || 'Unassigned';
                      return studentSection === section;
                    })
                    .map((student) => [student.id, {
                      studentId: student.id,
                      studentName: student.full_name || 'Unknown student',
                      studentEmail: student.email || 'No email',
                    }] as const),
                  ...[...labGroups.values()].flatMap((group) => group.submissions).map((submission) => [submission.studentId, {
                    studentId: submission.studentId,
                    studentName: submission.studentName,
                    studentEmail: submission.studentEmail,
                  }] as const),
                ]
              ).values(),
            ];

            const query = labResultSearchQuery.trim().toLowerCase();
            const cleanSectionQuery = query.replace(/^section\s+/i, '').trim();
            const sectionMatches = section.toLowerCase().includes(query) || (cleanSectionQuery ? section.toLowerCase().includes(cleanSectionQuery) : false);

            const filteredResultStudents = resultStudents.filter((student) => {
              if (!query) return true;
              if (sectionMatches) return true;
              const nameMatches = student.studentName.toLowerCase().includes(query);
              const emailMatches = student.studentEmail.toLowerCase().includes(query);
              return nameMatches || emailMatches;
            });

            if (showLaboratoryResults && query && filteredResultStudents.length === 0) {
              return null;
            }

            const sectionExpanded = expandedSections[section] ?? true;
            const sectionSubmissionCount = [...labGroups.values()].reduce(
              (total, group) => total + group.submissions.length,
              0
            );

            return (
              <div key={section} className={`border ${isLightMode ? 'border-slate-200' : 'border-slate-800'} rounded-2xl overflow-hidden shadow-sm`}>
                <button
                  type="button"
                  onClick={() => setExpandedSections((current) => ({ ...current, [section]: !sectionExpanded }))}
                  className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 ${sectionHeaderClass} text-left transition-colors`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <User className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-bold text-sm">Section {section}</span>
                    <span className={`text-xs ${isLightMode ? 'bg-slate-200 text-slate-700' : 'bg-slate-700/60 text-slate-300'} px-2 py-0.5 rounded-full font-medium`}>
                      {showLaboratoryResults
                        ? `${filteredResultStudents.length} student${filteredResultStudents.length !== 1 ? 's' : ''}`
                        : `${sectionSubmissionCount} submission${sectionSubmissionCount !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {sectionExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {sectionExpanded && (
                  <div className={`space-y-3 p-4 ${sectionBodyClass}`}>
                    {showLaboratoryResults && <div id="lab-results" className={`overflow-hidden rounded-xl border ${isLightMode ? 'border-slate-200 bg-white' : 'border-slate-800/90 bg-slate-900/70'}`}>
                      <div className={`flex items-center justify-between gap-3 border-b ${isLightMode ? 'border-slate-200' : 'border-slate-800'} px-4 py-3`}>
                        <div>
                          <h3 className={`text-sm font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Laboratory Results</h3>
                          <p className="mt-1 text-xs text-slate-500">One row per student</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => exportSection(section, resultLabGroups, filteredResultStudents)}
                          className={`${isLightMode ? 'border-slate-200 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                        >
                          <Download className="mr-2 h-3.5 w-3.5" />
                          Export Section
                        </Button>
                      </div>
                      {/* Desktop Table View */}
                      <div className="hidden sm:block overflow-x-auto max-h-[70vh] overflow-y-auto relative">
                        <table className="w-full text-left text-sm border-separate border-spacing-0">
                          <thead className={`sticky top-0 z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] ${isLightMode ? 'bg-slate-50 text-slate-600' : 'bg-slate-900 text-slate-400'} text-xs uppercase`}>
                            <tr>
                              <th className={`sticky top-0 left-0 z-30 px-4 py-3 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] ${isLightMode ? 'bg-slate-50' : 'bg-slate-900'}`}>Student</th>
                              {[...resultLabGroups.values()].map((group) => (
                                <th key={group.title} className={`min-w-40 px-4 py-3 sticky top-0 ${isLightMode ? 'bg-slate-50' : 'bg-slate-900'}`}>{group.title}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-slate-800'}`}>
                            {filteredResultStudents.map((student) => (
                              <tr key={student.studentId} className={`${isLightMode ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-300 hover:bg-slate-800/40'} transition-colors`}>
                                <td className={`sticky left-0 z-10 px-4 py-3 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] ${isLightMode ? 'bg-white' : 'bg-slate-900'}`}>
                                  <div className={`font-medium ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{student.studentName}</div>
                                  <div className="text-xs text-slate-500">{student.studentEmail}</div>
                                </td>
                                  {[...resultLabGroups.entries()].map(([labId, group]) => {
                                  const submission = group.submissions.find((item) => item.studentId === student.studentId);
                                  const isGraded = submission?.grade !== null && submission?.grade !== undefined;
                                  return (
                                    <td key={labId} className="px-4 py-3">
                                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${isGraded
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                        : submission
                                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                          : 'border-slate-600 bg-slate-800/80 text-slate-300'}`}>
                                        {submission ? 'Finished' : 'Untaken'}
                                      </span>
                                      {isGraded && <div className="mt-1 font-semibold text-emerald-400">{submission?.grade}/100</div>}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card-based View */}
                      <div className="block sm:hidden p-3 space-y-3">
                        {filteredResultStudents.map((student) => {
                          const labsList = [...resultLabGroups.entries()];
                          const completedCount = labsList.filter(([, group]) =>
                            group.submissions.some((item) => item.studentId === student.studentId)
                          ).length;

                          return (
                            <div
                              key={student.studentId}
                              className={`p-3.5 rounded-xl border space-y-3 ${
                                isLightMode ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/40 border-slate-800'
                              }`}
                            >
                              <div className={`sticky top-0 z-10 p-2 -mx-2 -mt-1 rounded-lg backdrop-blur-md flex items-center justify-between gap-2 shadow-sm border ${
                                isLightMode ? 'bg-white/95 border-slate-100' : 'bg-slate-900/95 border-slate-800'
                              }`}>
                                <div className="min-w-0">
                                  <h4 className={`font-semibold text-sm truncate ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                    {student.studentName}
                                  </h4>
                                  <p className="text-xs text-slate-500 truncate">{student.studentEmail}</p>
                                </div>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 border ${
                                  completedCount === labsList.length && labsList.length > 0
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                    : 'bg-violet-500/10 border-violet-500/20 text-violet-500'
                                }`}>
                                  {completedCount}/{labsList.length} Finished
                                </span>
                              </div>

                              <div className={`space-y-1.5 pt-2 border-t ${isLightMode ? 'border-slate-200/80' : 'border-slate-800/80'}`}>
                                {labsList.map(([labId, group]) => {
                                  const submission = group.submissions.find((item) => item.studentId === student.studentId);
                                  const isGraded = submission?.grade !== null && submission?.grade !== undefined;
                                  return (
                                    <div key={labId} className="flex items-center justify-between gap-2 text-xs py-1">
                                      <span className={`truncate text-xs ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                                        {group.title}
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${isGraded
                                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                          : submission
                                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                            : isLightMode ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                                          {submission ? 'Finished' : 'Untaken'}
                                        </span>
                                        {isGraded && (
                                          <span className="font-bold text-emerald-500 text-xs">
                                            {submission?.grade}/100
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>}

                    {!showLaboratoryResults && [...labGroups.entries()].map(([labId, group]) => {
                      const expanded = expandedLabs[`${section}:${labId}`] ?? true;
                      return (
                        <div key={labId} className={`border ${isLightMode ? 'border-slate-200' : 'border-slate-800/90'} rounded-xl overflow-hidden`}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLabs((current) => ({ ...current, [`${section}:${labId}`]: !expanded }))
                            }
                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 ${nestedHeaderClass} text-left transition-colors`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Beaker className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="font-semibold text-xs sm:text-sm truncate">
                                {group.title || labId}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({group.submissions.length})
                              </span>
                            </div>
                            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          </button>

                          {expanded && (
                            <div className={`grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 ${nestedBodyClass}`}>
                              {group.submissions.map((sub) => {
                                const isGraded = sub.grade !== null && sub.grade !== undefined;
                                return (
                                  <div
                                    key={sub.id}
                                    className={`${submissionCardClass} border rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all flex flex-col justify-between shadow-md`}
                                  >
                                    {/* Thumbnail */}
                                    <div
                                      className={`relative w-full h-40 ${thumbnailClass} flex items-center justify-center cursor-pointer group overflow-hidden`}
                                      onClick={() => setViewingFile(sub)}
                                    >
                                      {sub.fileType === 'link' ? (
                                        <ExternalLink className="w-8 h-8 text-cyan-400" />
                                      ) : sub.fileType.startsWith('video/') ? (
                                        <video
                                          src={previewUrls[sub.id]}
                                          muted
                                          preload="metadata"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <img
                                          src={previewUrls[sub.id]}
                                          alt={sub.fileName}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                      )}
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Eye className="w-7 h-7 text-white" />
                                      </div>
                                      <div className="absolute top-2 left-2">
                                        <span className="bg-black/75 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1 backdrop-blur-sm">
                                          {sub.fileType === 'link' ? (
                                            <ExternalLink className="w-3 h-3 text-cyan-400" />
                                          ) : sub.fileType.startsWith('video/') ? (
                                            <FileVideo className="w-3 h-3 text-cyan-400" />
                                          ) : (
                                            <ImageIcon className="w-3 h-3 text-emerald-400" />
                                          )}
                                          {sub.fileType === 'link' ? 'Link' : sub.fileType.startsWith('video/') ? 'Video' : 'Image'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                                      <div className="space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                          <h4 className={`font-bold ${isLightMode ? 'text-slate-900' : 'text-white'} text-xs sm:text-sm truncate`}>
                                            {sub.studentName}
                                          </h4>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {statusIcon(sub.status)}
                                            {isGraded ? (
                                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                {sub.grade}/100
                                              </span>
                                            ) : (
                                              <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">
                                                Pending
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <p className="text-[11px] text-slate-400 truncate">{sub.fileName}</p>

                                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                          <Calendar className="w-3 h-3 shrink-0" />
                                          {new Date(sub.submittedAt).toLocaleDateString()}
                                        </div>

                                        {sub.note && (
                                          <p className={`text-xs ${isLightMode ? 'text-slate-700 bg-slate-50' : 'text-slate-300 bg-slate-950/40'} line-clamp-2 italic p-2 rounded-lg`}>
                                            "{sub.note}"
                                          </p>
                                        )}

                                        {sub.feedback && (
                                          <p className="text-[11px] text-emerald-300 line-clamp-2 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/15">
                                            Feedback: {sub.feedback}
                                          </p>
                                        )}
                                      </div>

                                      <div className={`flex gap-2 pt-2 border-t ${isLightMode ? 'border-slate-200' : 'border-slate-800/80'}`}>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className={`flex-1 ${isLightMode ? 'border-slate-200 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'} text-xs h-8`}
                                          onClick={() => setViewingFile(sub)}
                                        >
                                          <Eye className="w-3.5 h-3.5 mr-1" />
                                          Preview
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-semibold"
                                          onClick={() => openGradeModal(sub)}
                                        >
                                          <Star className="w-3.5 h-3.5 mr-1" />
                                          {isGraded ? 'Update' : 'Grade'}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Bulk Review Confirmation Modal */}
      <AlertDialog open={bulkReviewDialogOpen} onOpenChange={setBulkReviewDialogOpen}>
        <AlertDialogContent className={`border ${isLightMode ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCheck className="w-5 h-5 text-emerald-500" />
              Mark All Pending Submissions Reviewed
            </AlertDialogTitle>
            <AlertDialogDescription className={isLightMode ? 'text-slate-600' : 'text-slate-400'}>
              This will automatically mark all <span className="font-semibold text-emerald-600 dark:text-emerald-400">{pendingCount}</span> pending student laboratory submission{pendingCount !== 1 ? 's' : ''} as reviewed and assign the default passing grade and verification feedback.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                Assigned Grade (0 – 100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={bulkReviewScore}
                onChange={(e) => setBulkReviewScore(Math.min(100, Math.max(0, Number(e.target.value))))}
                className={`w-full rounded-xl border px-3 py-2 text-sm font-bold ${
                  isLightMode
                    ? 'border-slate-300 bg-white text-slate-900'
                    : 'border-slate-700 bg-slate-950 text-white'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                Verification Feedback
              </label>
              <textarea
                rows={2}
                value={bulkReviewFeedback}
                onChange={(e) => setBulkReviewFeedback(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs resize-none ${
                  isLightMode
                    ? 'border-slate-300 bg-white text-slate-900'
                    : 'border-slate-700 bg-slate-950 text-white'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isBulkReviewing}
              className={isLightMode ? 'border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300'}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkReviewing}
              onClick={(e) => {
                e.preventDefault();
                handleBulkMarkAllReviewed();
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isBulkReviewing ? 'Processing...' : `Confirm & Mark (${pendingCount})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
