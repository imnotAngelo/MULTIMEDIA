import { useEffect, useMemo, useState } from 'react';
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
  Award,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { toast } from 'sonner';

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

export function LaboratorySubmissions() {
  const [error, setError] = useState<string | null>(null);

  // File submissions from instructor-assigned labs
  const [fileSubs, setFileSubs] = useState<FileSubmission[]>([]);
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded'>('all');

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    if (fileSubs.length === 0) return;

    Promise.all(
      fileSubs.map(async (submission) => {
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

  // Load file submissions
  useEffect(() => {
    authFetch('/laboratory-submissions/all-files')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to load submissions (${r.status})`);
        }
        return r.json();
      })
      .then((rows: FileSubmission[]) =>
        setFileSubs(
          rows.map((row) => ({
            ...row,
            studentSection: row.studentSection || (row as FileSubmission & { section?: string }).section || 'Unassigned',
            grade:
              row.grade === null || row.grade === undefined || (row.grade as any) === ''
                ? null
                : Number(row.grade),
          }))
        )
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load file submissions'))
      .finally(() => setLoadingFileSubs(false));
  }, []);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return fileSubs.filter((sub) => {
      const matchesSearch =
        searchQuery === '' ||
        sub.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.labTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.studentSection?.toLowerCase().includes(searchQuery.toLowerCase());

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
    return [...groups.entries()];
  }, [filteredSubmissions]);

  // Quick stats
  const totalCount = fileSubs.length;
  const gradedCount = fileSubs.filter((s) => s.grade !== null && s.grade !== undefined).length;
  const pendingCount = totalCount - gradedCount;
  const averageGrade =
    gradedCount > 0
      ? Math.round(
          fileSubs
            .filter((s) => s.grade !== null && s.grade !== undefined)
            .reduce((acc, s) => acc + Number(s.grade), 0) / gradedCount
        )
      : 0;

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
      setFileSubs((prev) =>
        prev.map((s) =>
          s.id === gradingFile.id
            ? { ...s, grade: gradeForm.grade, feedback: gradeForm.feedback, status: gradeForm.status }
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

  const statusIcon = (s: string) => {
    if (s === 'approved') return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    if (s === 'rejected') return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (s === 'reviewed') return <Star className="w-3.5 h-3.5 text-amber-400" />;
    return <Clock className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Laboratory Submissions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Evaluate hands-on student laboratory work, inspect uploaded media, and provide rubric feedback.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Submissions</span>
            <Beaker className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{totalCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Across all assigned labs</p>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">{pendingCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting instructor evaluation</p>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Graded</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{gradedCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Reviewed with score &amp; feedback</p>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Average Grade</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400">
            {averageGrade > 0 ? `${averageGrade}%` : 'N/A'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Class average score</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, lab, or section..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('graded')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'graded'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Graded ({gradedCount})
          </button>
        </div>
      </div>

      {/* Grading Modal */}
      {gradingFile && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setGradingFile(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <div>
                <h2 className="text-base font-bold text-white">Grade Student Submission</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {gradingFile.studentName} · {gradingFile.labTitle}
                </p>
              </div>
              <button onClick={() => setGradingFile(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Score (0 – 100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeForm.grade}
                    onChange={(e) =>
                      setGradeForm((f) => ({ ...f, grade: Math.min(100, Math.max(0, Number(e.target.value))) }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Status</label>
                  <select
                    value={gradeForm.status}
                    onChange={(e) => setGradeForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Needs Revision</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Rubric &amp; Student Feedback</label>
                <textarea
                  rows={3}
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))}
                  placeholder="Provide constructive feedback the student will see in their portfolio..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs resize-none focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300"
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
                {viewingFile.fileType.startsWith('video/') ? (
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
      <Card className="bg-slate-900/60 border-slate-800 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Beaker className="w-5 h-5 text-emerald-400" />
            Assigned Lab Files &amp; Media
          </h2>
          {loadingFileSubs && <AetherSpinner className="w-4 h-4 text-slate-400" />}
        </div>

        {!loadingFileSubs && filteredSubmissions.length === 0 && (
          <div className="text-sm text-slate-400 py-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/20">
            <Beaker className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-slate-300">No matching submissions found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filter settings.</p>
          </div>
        )}

        <div className="space-y-4">
          {groupedFileSubs.map(([section, labGroups]) => {
            const sectionExpanded = expandedSections[section] ?? true;
            const sectionSubmissionCount = [...labGroups.values()].reduce(
              (total, group) => total + group.submissions.length,
              0
            );

            return (
              <div key={section} className="border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedSections((current) => ({ ...current, [section]: !sectionExpanded }))}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <User className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-bold text-slate-100 text-sm">Section {section}</span>
                    <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                      {sectionSubmissionCount} submission{sectionSubmissionCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {sectionExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {sectionExpanded && (
                  <div className="space-y-3 p-4 bg-slate-950/40">
                    {[...labGroups.entries()].map(([labId, group]) => {
                      const expanded = expandedLabs[`${section}:${labId}`] ?? true;
                      return (
                        <div key={labId} className="border border-slate-800/90 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLabs((current) => ({ ...current, [`${section}:${labId}`]: !expanded }))
                            }
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 hover:bg-slate-800/70 text-left transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Beaker className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="font-semibold text-slate-200 text-xs sm:text-sm truncate">
                                {group.title || labId}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({group.submissions.length})
                              </span>
                            </div>
                            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          </button>

                          {expanded && (
                            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 bg-slate-950/20">
                              {group.submissions.map((sub) => {
                                const isGraded = sub.grade !== null && sub.grade !== undefined;
                                return (
                                  <div
                                    key={sub.id}
                                    className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all flex flex-col justify-between shadow-md"
                                  >
                                    {/* Thumbnail */}
                                    <div
                                      className="relative w-full h-40 bg-slate-950 flex items-center justify-center cursor-pointer group overflow-hidden"
                                      onClick={() => setViewingFile(sub)}
                                    >
                                      {sub.fileType.startsWith('video/') ? (
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
                                          {sub.fileType.startsWith('video/') ? (
                                            <FileVideo className="w-3 h-3 text-cyan-400" />
                                          ) : (
                                            <ImageIcon className="w-3 h-3 text-emerald-400" />
                                          )}
                                          {sub.fileType.startsWith('video/') ? 'Video' : 'Image'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                                      <div className="space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                          <h4 className="font-bold text-white text-xs sm:text-sm truncate">
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
                                          <p className="text-xs text-slate-300 line-clamp-2 italic bg-slate-950/40 p-2 rounded-lg">
                                            "{sub.note}"
                                          </p>
                                        )}

                                        {sub.feedback && (
                                          <p className="text-[11px] text-emerald-300 line-clamp-2 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/15">
                                            Feedback: {sub.feedback}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex gap-2 pt-2 border-t border-slate-800/80">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"
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
    </div>
  );
}
