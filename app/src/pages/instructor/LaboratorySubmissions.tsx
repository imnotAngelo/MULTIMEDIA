import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import {
  getSubmissions,
  updateSubmission,
  type LaboratorySubmission,
} from '@/lib/laboratorySubmissionService';
import { ExternalLink, Loader2, Save, Beaker, ImageIcon, FileVideo, Eye, X, Calendar, User, Star, CheckCircle, Clock, XCircle } from 'lucide-react';

interface FileSubmission {
  id: string;
  labId: string;
  labTitle: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
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

type Unit = { id: string; title?: string; name?: string };

export function LaboratorySubmissions() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<LaboratorySubmission[]>([]);

  // File submissions from instructor-assigned labs
  const [fileSubs, setFileSubs] = useState<FileSubmission[]>([]);
  const [loadingFileSubs, setLoadingFileSubs] = useState(true);
  const [viewingFile, setViewingFile] = useState<FileSubmission | null>(null);
  const [gradingFile, setGradingFile] = useState<FileSubmission | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: 0, feedback: '', status: 'reviewed' });
  const [savingGrade, setSavingGrade] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'unit'>('files');

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [units, selectedUnitId]
  );

  useEffect(() => {
    const loadUnits = async () => {
      try {
        setLoadingUnits(true);
        setError(null);
        const res = await authFetch('/units');
        if (!res.ok) throw new Error('Failed to load units');
        const data: unknown = await res.json();
        const list = Array.isArray(data) ? (data as Unit[]) : [];
        setUnits(list);
        setSelectedUnitId(list[0]?.id ?? '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load units');
      } finally {
        setLoadingUnits(false);
      }
    };
    loadUnits();
  }, []);

  useEffect(() => {
    const loadSubmissions = async () => {
      if (!selectedUnitId) return;
      try {
        setLoadingSubs(true);
        setError(null);
        const data = await getSubmissions(selectedUnitId);
        setSubmissions(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load submissions');
      } finally {
        setLoadingSubs(false);
      }
    };
    loadSubmissions();
  }, [selectedUnitId]);

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
      .then((rows: FileSubmission[]) => setFileSubs(rows))
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

  const handleSave = async (
    submissionId: string,
    patch: { grade?: number; instructorFeedback?: string; status?: string }
  ) => {
    try {
      setError(null);
      const updated = await updateSubmission(submissionId, patch);
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updated : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save grade');
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
                  {savingGrade ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
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
                  <video src={viewingFile.fileUrl} controls className="w-full max-h-80 object-contain" />
                ) : (
                  <img src={viewingFile.fileUrl} alt={viewingFile.fileName} className="w-full max-h-80 object-contain" />
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

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'files'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Beaker className="w-3.5 h-3.5" />
              File Submissions
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'files' ? 'bg-white/20' : 'bg-slate-700 text-slate-300'}`}>
                {fileSubs.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('unit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'unit'
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Unit Submissions
            </button>
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-300">{error}</div>}
      </Card>

      {/* ── File Submissions Tab ─────────────────────────────── */}
      {activeTab === 'files' && (
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Instructor-Assigned Lab Files</h2>
            {loadingFileSubs && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>

          {!loadingFileSubs && fileSubs.length === 0 && (
            <div className="text-sm text-slate-400 py-8 text-center">No file submissions yet.</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {fileSubs.map(sub => (
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
                    <video src={sub.fileUrl} muted preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <img src={sub.fileUrl} alt={sub.fileName} className="w-full h-full object-cover" />
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
                      {sub.grade !== null
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
          </div>
        </Card>
      )}

      {/* ── Unit Submissions Tab ─────────────────────────────── */}
      {activeTab === 'unit' && (
        <>
          <Card className="bg-slate-900/60 border-slate-800 p-5">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300">Unit</label>
              <select
                className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                disabled={loadingUnits}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title ?? u.name ?? u.id}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100">
                {selectedUnit
                  ? selectedUnit.title ?? selectedUnit.name ?? 'Selected Unit'
                  : 'Submissions'}
              </h2>
              {loadingSubs && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              )}
            </div>

            {!loadingSubs && submissions.length === 0 && (
              <div className="text-sm text-slate-400">No submissions yet.</div>
            )}

            <div className="space-y-4">
              {submissions.map((s) => (
                <SubmissionCard key={s.id} submission={s} onSave={handleSave} />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SubmissionCard({
  submission,
  onSave,
}: {
  submission: LaboratorySubmission;
  onSave: (id: string, patch: { grade?: number; instructorFeedback?: string; status?: string }) => Promise<void>;
}) {
  const [grade, setGrade] = useState<number>(submission.grade ?? 0);
  const [feedback, setFeedback] = useState<string>(submission.instructor_feedback ?? '');
  const [status, setStatus] = useState<string>(submission.status ?? 'submitted');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGrade(submission.grade ?? 0);
    setFeedback(submission.instructor_feedback ?? '');
    setStatus(submission.status ?? 'submitted');
  }, [submission.id, submission.grade, submission.instructor_feedback, submission.status]);

  const submissionUrl = submission.canva_url;

  return (
    <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-slate-100 font-medium truncate">
            {submission.project_title || 'Untitled Project'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Student: {submission.student?.email ?? submission.student_id}
          </div>
          <div className="text-xs text-slate-500 mt-1">Status: {status}</div>
        </div>

        {submissionUrl ? (
          <Button asChild variant="outline" className="border-slate-700 text-slate-200">
            <a href={submissionUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open submission
            </a>
          </Button>
        ) : (
          <div className="text-xs text-slate-500">No link</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Grade (0-100)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={Number.isFinite(grade) ? grade : 0}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
          >
            <option value="submitted">submitted</option>
            <option value="reviewed">reviewed</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(submission.id, { grade, instructorFeedback: feedback, status });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save grade
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs text-slate-400 mb-1">Feedback</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full min-h-[90px] bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
          placeholder="Write feedback for the student..."
        />
      </div>
    </div>
  );
}

