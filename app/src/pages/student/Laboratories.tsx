import { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  ExternalLink,
  Beaker,
  Calendar,
  RefreshCw,
  AlertCircle,
  Zap,
  Upload,
  CheckCircle2,
  X,
  Send,
  FileUp,
  Eye,
} from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

// --- Instructor-assigned labs (synced from localStorage) ---
interface InstructorLab {
  id: string;
  title: string;
  description: string;
  platform: string;
  platformUrl: string;
  unitId: string;
  unitName: string;
  dueDate: string;
  createdAt: string;
}

interface Submission {
  id?: string;
  fileName: string;
  fileType: string;
  /** Served URL (from API) or base64 fallback */
  fileUrl: string;
  note: string;
  submittedAt: string;
}

const CACHE_KEY = 'student_lab_submissions_cache';

function loadCache(): Record<string, Submission> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}

function saveCache(data: Record<string, Submission>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

const PLATFORM_BADGE: Record<string, string> = {
  'Canva': 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  'Figma': 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  'Adobe Photoshop': 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  'Adobe Illustrator': 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  'Adobe Premiere Pro': 'bg-violet-500/10 border-violet-500/30 text-violet-400',
  'Adobe After Effects': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  'DaVinci Resolve': 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  'Google Slides': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  'PowerPoint': 'bg-red-500/10 border-red-500/30 text-red-400',
};
const getPlatformBadge = (p: string) =>
  PLATFORM_BADGE[p] ?? 'bg-slate-500/10 border-slate-500/30 text-slate-400';

function loadInstructorLabs(): InstructorLab[] {
  try {
    return JSON.parse(localStorage.getItem('instructor_laboratories') || '[]');
  } catch { return []; }
}

function InstructorLabsSection() {
  const [labs, setLabs] = useState<InstructorLab[]>(loadInstructorLabs);

  const refresh = () => setLabs(loadInstructorLabs());

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  const daysLabel = (d: string) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-400' };
    if (diff === 0) return { text: 'Due today', cls: 'text-amber-400' };
    if (diff <= 3) return { text: `Due in ${diff}d`, cls: 'text-amber-400' };
    return { text: `Due in ${diff}d`, cls: 'text-slate-400' };
  };

  if (labs.length === 0) return null;

  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Assigned Laboratories</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 font-medium">{labs.length}</span>
        </div>
        <button onClick={refresh} className="text-slate-500 hover:text-slate-300 transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {labs.map(lab => {
          const dl = daysLabel(lab.dueDate);
          const isOverdue = lab.dueDate ? new Date(lab.dueDate).getTime() < Date.now() : false;
          return (
            <div
              key={lab.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 hover:border-violet-500/30 transition-all"
            >
              {/* Platform badge + title */}
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg border shrink-0 ${getPlatformBadge(lab.platform)}`}>
                  <Beaker className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-sm leading-tight">{lab.title}</h3>
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mt-1 ${getPlatformBadge(lab.platform)}`}>
                    {lab.platform}
                  </span>
                </div>
              </div>

              {/* Description */}
              {lab.description && (
                <p className="text-slate-400 text-xs line-clamp-2">{lab.description}</p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-xs">
                {lab.unitName && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <BookOpen className="w-3 h-3" />{lab.unitName}
                  </span>
                )}
                {lab.dueDate && (
                  <span className={`flex items-center gap-1 ${dl?.cls ?? 'text-slate-400'}`}>
                    <Calendar className="w-3 h-3" />
                    {formatDate(lab.dueDate)}
                    {dl && <span className="ml-0.5">({dl.text})</span>}
                  </span>
                )}
              </div>

              {/* Open button */}
              <a
                href={lab.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in {lab.platform}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// -----------------------------------------------------------

export function Laboratories() {
  const [labs, setLabs] = useState<InstructorLab[]>(loadInstructorLabs);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>(loadCache);
  const [submittingLabId, setSubmittingLabId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [submitNote, setSubmitNote] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewingLabId, setViewingLabId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load submissions from API on mount; fall back to cache if offline
  useEffect(() => {
    authFetch('/laboratory-submissions/my-files')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((map: Record<string, any>) => {
        const parsed: Record<string, Submission> = {};
        for (const [labId, row] of Object.entries(map)) {
          parsed[labId] = {
            id: row.id,
            fileName: row.fileName,
            fileType: row.fileType,
            fileUrl: row.fileUrl,
            note: row.note ?? '',
            submittedAt: row.submittedAt,
          };
        }
        setSubmissions(parsed);
        saveCache(parsed);
      })
      .catch(() => { /* offline – keep cache */ });
  }, []);

  const refresh = () => setLabs(loadInstructorLabs());

  const openModal = (labId: string) => {
    setSelectedFile(null);
    setPreviewUrl('');
    setSubmitNote(submissions[labId]?.note ?? '');
    setSubmitError('');
    setSubmittingLabId(labId);
  };

  const closeModal = () => {
    setSubmittingLabId(null);
    setSelectedFile(null);
    setPreviewUrl('');
    setSubmitNote('');
    setSubmitError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError('');
    if (file.size > 50 * 1024 * 1024) {
      setSubmitError('File is too large. Maximum size is 50 MB.');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setSubmitError('Please select a photo or video file to submit.');
      return;
    }
    if (!submittingLabId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const lab = labs.find(l => l.id === submittingLabId);
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('labId', submittingLabId);
      form.append('labTitle', lab?.title ?? '');
      form.append('note', submitNote.trim());

      const res = await authFetch('/laboratory-submissions/upload-file', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errMsg =
          typeof body.error === 'string'
            ? body.error
            : typeof body.error === 'object' && body.error?.message
            ? body.error.message
            : body.message ?? `Upload failed (${res.status})`;
        throw new Error(errMsg);
      }

      const data = await res.json();
      const updated = {
        ...submissions,
        [submittingLabId]: {
          id: data.id,
          fileName: data.fileName,
          fileType: data.fileType,
          fileUrl: data.fileUrl,
          note: data.note ?? '',
          submittedAt: data.submittedAt,
        },
      };
      setSubmissions(updated);
      saveCache(updated);
      closeModal();
    } catch (err: any) {
      setSubmitError(err.message ?? 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';

  const daysLabel = (d: string) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-400' };
    if (diff === 0) return { text: 'Due today', cls: 'text-amber-400' };
    if (diff <= 3) return { text: `Due in ${diff}d`, cls: 'text-amber-400' };
    return { text: `Due in ${diff}d`, cls: 'text-slate-400' };
  };

  return (
    <div className="space-y-6">
      {/* File-upload Submission Modal */}
      {submittingLabId && (() => {
        const lab = labs.find(l => l.id === submittingLabId);
        if (!lab) return null;
        const isVideo = selectedFile?.type.startsWith('video/');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Submit Work</h2>
                    <p className="text-xs text-slate-400 truncate max-w-64">{lab.title}</p>
                  </div>
                </div>
                <button onClick={closeModal} className="text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-4">
                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{submitError}</p>
                  </div>
                )}

                {/* Drop zone / file picker */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Upload your work <span className="text-red-400">*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 flex flex-col items-center gap-3 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-emerald-500/10 flex items-center justify-center transition-colors">
                      <FileUp className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    {selectedFile ? (
                      <div className="text-center">
                        <p className="text-sm font-medium text-emerald-400">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm text-slate-300">Click to choose a photo or video</p>
                        <p className="text-xs text-slate-500 mt-0.5">PNG, JPG, GIF, MP4, MOV — max 50 MB</p>
                      </div>
                    )}
                  </button>
                </div>

                {/* Preview */}
                {previewUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                    {isVideo ? (
                      <video src={previewUrl} controls className="w-full max-h-48 object-contain" />
                    ) : (
                      <img src={previewUrl} alt="preview" className="w-full max-h-48 object-contain" />
                    )}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Notes <span className="text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    value={submitNote}
                    onChange={e => setSubmitNote(e.target.value)}
                    placeholder="Any notes for your instructor..."
                    rows={2}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Preview Modal */}
      {viewingLabId && submissions[viewingLabId] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">Your Submission</h2>
              <button onClick={() => setViewingLabId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                {submissions[viewingLabId].fileType.startsWith('video/') ? (
                  <video src={submissions[viewingLabId].fileUrl} controls className="w-full max-h-96 object-contain" />
                ) : (
                  <img src={submissions[viewingLabId].fileUrl} alt="submission" className="w-full max-h-96 object-contain" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{submissions[viewingLabId].fileName}</span>
                <span>Submitted {new Date(submissions[viewingLabId].submittedAt).toLocaleString()}</span>
              </div>
              {submissions[viewingLabId].note && (
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-xs text-slate-300">{submissions[viewingLabId].note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Laboratories</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Laboratories assigned by your instructor
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/50 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center mb-2">
            <Beaker className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white">{labs.length}</div>
          <p className="text-slate-500 text-xs mt-1">Total Laboratories</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {labs.filter(l => l.dueDate && new Date(l.dueDate).getTime() >= Date.now()).length}
          </div>
          <p className="text-slate-500 text-xs mt-1">Upcoming</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {new Set(labs.map(l => l.platform)).size}
          </div>
          <p className="text-slate-500 text-xs mt-1">Platforms</p>
        </div>
      </div>

      {/* Lab List */}
      {labs.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <Beaker className="w-7 h-7 text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Laboratories Yet</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Your instructor hasn't posted any laboratories yet. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {labs.map(lab => {
            const dl = daysLabel(lab.dueDate);
            const isOverdue = lab.dueDate
              ? new Date(lab.dueDate).getTime() < Date.now()
              : false;

            return (
              <div
                key={lab.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 hover:border-violet-500/30 transition-all"
              >
                {/* Icon + title */}
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg border shrink-0 ${getPlatformBadge(lab.platform)}`}>
                    <Beaker className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm leading-tight mb-1">
                      {lab.title}
                    </h3>
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${getPlatformBadge(lab.platform)}`}>
                      {lab.platform}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {lab.description && (
                  <p className="text-slate-400 text-xs line-clamp-3">{lab.description}</p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap gap-3 text-xs">
                  {lab.unitName && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      {lab.unitName}
                    </span>
                  )}
                  {lab.dueDate && (
                    <span className={`flex items-center gap-1 ${dl?.cls ?? 'text-slate-400'}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(lab.dueDate)}
                      {dl && <span className="ml-0.5">({dl.text})</span>}
                    </span>
                  )}
                </div>

                {/* Overdue warning */}
                {isOverdue && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <p className="text-red-400 text-xs">This laboratory is past due</p>
                  </div>
                )}

                {/* Submitted badge */}
                {submissions[lab.id] && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <p className="text-emerald-400 text-xs flex-1">
                      Submitted · {submissions[lab.id].fileName}
                    </p>
                    <button
                      onClick={() => setViewingLabId(lab.id)}
                      className="text-emerald-400 hover:text-emerald-300 transition-colors"
                      title="Preview submission"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-auto flex gap-2">
                  <a
                    href={lab.platformUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 flex-1 px-3 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </a>
                  <button
                    onClick={() => openModal(lab.id)}
                    className={`flex items-center justify-center gap-2 flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      submissions[lab.id]
                        ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    {submissions[lab.id] ? 'Resubmit' : 'Submit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

