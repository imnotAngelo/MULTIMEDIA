import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';
import { Save, Beaker, ImageIcon, FileVideo, Eye, X, Calendar, User, Star, CheckCircle, Clock, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';

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

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    if (fileSubs.length === 0) return;

    Promise.all(fileSubs.map(async (submission) => {
      try {
        const response = await authFetch(resolveBackendAssetUrl(submission.fileUrl));
        if (!response.ok) return null;
        const objectUrl = URL.createObjectURL(await response.blob());
        objectUrls.push(objectUrl);
        return [submission.id, objectUrl] as const;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (cancelled) return;
      setPreviewUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
    });

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [fileSubs]);

  const groupedFileSubs = useMemo(() => {
    const groups = new Map<string, Map<string, { title: string; submissions: FileSubmission[] }>>();
    for (const submission of fileSubs) {
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
  }, [fileSubs]);

  // Load file submissions from instructor-assigned labs
  useEffect(() => {
    authFetch('/laboratory-submissions/all-files')
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to load submissions (${r.status})`);
        }
        return r.json();
      })
      .then((rows: FileSubmission[]) => setFileSubs(rows.map((row) => ({
        ...row,
        studentSection: row.studentSection || (row as FileSubmission & { section?: string }).section || 'Unassigned',
        grade: row.grade === null || row.grade === undefined || (row.grade as any) === ''
          ? null
          : Number(row.grade),
      }))))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load file submissions'))
      .finally(() => setLoadingFileSubs(false));
  }, []);

  const openGradeModal = (sub: FileSubmission) => {
    setGradeForm({
      grade: sub.grade ?? 0,
      feedback: sub.feedback ?? '',
      status: sub.status === 'submitted' ? 'reviewed' : sub.status,
    });
    setGradingFile(sub);
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
      setFileSubs(prev => prev.map(s =>
        s.id === gradingFile.id
          ? { ...s, grade: gradeForm.grade, feedback: gradeForm.feedback, status: gradeForm.status }
          : s
      ));
      setGradingFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save grade');
    } finally {
      setSavingGrade(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === 'approved') return <CheckCircle className="w-3 h-3 text-emerald-400" />;
    if (s === 'rejected') return <XCircle className="w-3 h-3 text-red-400" />;
    if (s === 'reviewed') return <Star className="w-3 h-3 text-amber-400" />;
    return <Clock className="w-3 h-3 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Grading modal */}
      {gradingFile && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setGradingFile(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white">Grade Submission</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {gradingFile.studentName} · {gradingFile.labTitle}
                </p>
              </div>
              <button onClick={() => setGradingFile(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Grade (0 – 100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeForm.grade}
                    onChange={e => setGradeForm(f => ({ ...f, grade: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                  <select
                    value={gradeForm.status}
                    onChange={e => setGradeForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Feedback for student</label>
                <textarea
                  rows={3}
                  value={gradeForm.feedback}
                  onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
                  placeholder="Write feedback the student will see..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1 border-slate-700 text-slate-300" onClick={() => setGradingFile(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={savingGrade}
                  onClick={handleSaveGrade}
                >
                  {savingGrade ? <AetherSpinner className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Save Grade
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal for file submissions */}
      {viewingFile && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingFile(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white">{viewingFile.labTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {viewingFile.studentName} · {viewingFile.studentEmail}
                </p>
              </div>
              <button onClick={() => setViewingFile(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                {viewingFile.fileType.startsWith('video/') ? (
                  <video src={previewUrls[viewingFile.id]} controls className="w-full max-h-80 object-contain" />
                ) : (
                  <img src={previewUrls[viewingFile.id]} alt={viewingFile.fileName} className="w-full max-h-80 object-contain" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{viewingFile.fileName}{viewingFile.fileSize ? ` · ${(viewingFile.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}</span>
                <span>Submitted {new Date(viewingFile.submittedAt).toLocaleString()}</span>
              </div>
              {viewingFile.note && (
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-xs text-slate-300 italic">"{viewingFile.note}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Laboratory Submissions</h1>
            <p className="text-sm text-slate-400">
              Review student laboratory work.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <Beaker className="h-4 w-4" />
            {fileSubs.length} submission{fileSubs.length !== 1 ? 's' : ''}
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-300">{error}</div>}
      </Card>

      {/* ── File Submissions Tab ─────────────────────────────── */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Instructor-Assigned Lab Files</h2>
            {loadingFileSubs && <AetherSpinner className="w-4 h-4 text-slate-400" />}
          </div>

          {!loadingFileSubs && fileSubs.length === 0 && (
            <div className="text-sm text-slate-400 py-8 text-center">No file submissions yet.</div>
          )}

          <div className="space-y-4">
            {groupedFileSubs.map(([section, labGroups]) => {
              const sectionExpanded = expandedSections[section] ?? true;
              const sectionSubmissionCount = [...labGroups.values()].reduce((total, group) => total + group.submissions.length, 0);
              return <div key={section} className="border border-slate-700/80 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setExpandedSections((current) => ({ ...current, [section]: !sectionExpanded }))} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-800/70 hover:bg-slate-800 text-left">
                  <div className="flex items-center gap-2 min-w-0"><User className="w-4 h-4 text-cyan-400 shrink-0" /><span className="font-semibold text-slate-100">Section {section}</span><span className="text-xs text-slate-500">{sectionSubmissionCount} submission{sectionSubmissionCount !== 1 ? 's' : ''}</span></div>
                  {sectionExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {sectionExpanded && <div className="space-y-3 p-3 bg-slate-950/30">
                {[...labGroups.entries()].map(([labId, group]) => {
                  const expanded = expandedLabs[`${section}:${labId}`] ?? true;
                  return <div key={labId} className="border border-slate-800 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setExpandedLabs((current) => ({ ...current, [`${section}:${labId}`]: !expanded }))} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-950/70 hover:bg-slate-800/60 text-left">
                  <div className="flex items-center gap-2 min-w-0"><Beaker className="w-4 h-4 text-emerald-400 shrink-0" /><span className="font-semibold text-slate-100 truncate">{group.title || labId}</span><span className="text-xs text-slate-500">{group.submissions.length} student submission{group.submissions.length !== 1 ? 's' : ''}</span></div>
                  {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {expanded && <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 bg-slate-900/30">
                {group.submissions.map(sub => (
                  <div
                    key={sub.id}
                    className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-500/30 transition-all"
                  >
                {/* Thumbnail */}
                <div
                  className="relative w-full h-36 bg-slate-800 flex items-center justify-center cursor-pointer group overflow-hidden"
                  onClick={() => setViewingFile(sub)}
                >
                  {sub.fileType.startsWith('video/') ? (
                    <video src={previewUrls[sub.id]} muted preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <img src={previewUrls[sub.id]} alt={sub.fileName} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className="bg-black/70 rounded px-1.5 py-0.5 text-xs text-white flex items-center gap-1">
                      {sub.fileType.startsWith('video/') ? <FileVideo className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                      {sub.fileType.startsWith('video/') ? 'Video' : 'Photo'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-100 text-sm truncate">{sub.labTitle}</h3>
                    <span className="flex items-center gap-1 shrink-0">
                      {statusIcon(sub.status)}
                      {sub.grade !== null && sub.grade !== undefined
                        ? <span className="text-xs font-bold text-amber-400">{sub.grade}/100</span>
                        : <span className="text-xs text-slate-500">Ungraded</span>
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{sub.studentName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3 h-3 shrink-0" />
                    {new Date(sub.submittedAt).toLocaleDateString()}
                  </div>
                  {sub.note && (
                    <p className="text-xs text-slate-400 line-clamp-2 italic">"{sub.note}"</p>
                  )}
                  {sub.feedback && (
                    <p className="text-xs text-emerald-400 line-clamp-1">Feedback: {sub.feedback}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-slate-700 text-slate-200"
                      onClick={() => setViewingFile(sub)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white"
                      onClick={() => openGradeModal(sub)}
                    >
                      <Star className="w-3.5 h-3.5 mr-1" />
                      Grade
                    </Button>
                  </div>
                </div>
                  </div>
                ))}
                </div>}
                </div>;
                  })}
                  </div>}
                </div>;
            })}
          </div>
      </Card>
    </div>
  );
}

