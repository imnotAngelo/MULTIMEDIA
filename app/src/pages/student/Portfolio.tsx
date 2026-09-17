import { useState, useEffect, useMemo } from 'react';
import {
  Share2,
  Eye,
  Beaker,
  Calendar,
  FileVideo,
  ImageIcon,
  Sparkles,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  FolderArchive,
} from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { authFetch } from '@/lib/authFetch';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';

interface LabSubmission {
  id: string;
  labId: string;
  labTitle: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  note: string;
  submittedAt: string;
  grade: number | null;
  feedback: string;
  status: string;
}

export function Portfolio() {
  const { user } = useAuthStore();
  const [categoryTab, setCategoryTab] = useState<'all' | 'labs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [labSubmissions, setLabSubmissions] = useState<LabSubmission[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [viewingSub, setViewingSub] = useState<LabSubmission | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    if (labSubmissions.length === 0) return;

    Promise.all(
      labSubmissions.map(async (submission) => {
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
      if (!cancelled) {
        setPreviewUrls(
          Object.fromEntries(
            entries.filter((entry): entry is readonly [string, string] => Boolean(entry))
          )
        );
      }
    });

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [labSubmissions]);

  useEffect(() => {
    // Load lab file submissions
    const loadLabSubs = async () => {
      try {
        setLabsLoading(true);
        const [submissionsRes, laboratoriesRes] = await Promise.all([
          authFetch('/laboratory-submissions/my-files', { cache: 'no-store' }),
          authFetch('/laboratories', { cache: 'no-store' }),
        ]);
        if (!submissionsRes.ok) return;
        const map: Record<string, any> = await submissionsRes.json();
        const laboratoriesData = laboratoriesRes.ok ? await laboratoriesRes.json() : null;
        const activeLaboratoryIds = laboratoriesData
          ? new Set(
              (laboratoriesData.data ?? [])
                .filter((laboratory: any) => laboratory.status !== 'archived')
                .map((laboratory: any) => laboratory.id)
            )
          : null;
        const normalized = Object.values(map)
          .filter((row: any) => !activeLaboratoryIds || activeLaboratoryIds.has(row.labId))
          .map((row: any) => ({
            ...row,
            grade:
              row.grade !== undefined && row.grade !== null && row.grade !== ''
                ? Number(row.grade)
                : row.score !== undefined && row.score !== null && row.score !== ''
                ? Number(row.score)
                : row.points !== undefined && row.points !== null && row.points !== ''
                ? Number(row.points)
                : null,
            feedback: row.feedback ?? '',
            status: row.status ?? 'submitted',
          })) as LabSubmission[];
        setLabSubmissions(normalized);
      } catch {
        // offline
      } finally {
        setLabsLoading(false);
      }
    };

    loadLabSubs();

    const refreshOnReturn = () => loadLabSubs();
    window.addEventListener('focus', refreshOnReturn);
    return () => window.removeEventListener('focus', refreshOnReturn);
  }, []);

  const handleShare = (title: string) => {
    const shareUrl = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => toast.success(`Portfolio link copied for "${title}"`))
        .catch(() => toast.error('Could not copy link'));
    }
  };

  // Filtered lists
  const filteredLabs = useMemo(() => {
    return labSubmissions.filter((sub) => {
      return (
        searchQuery === '' ||
        sub.labTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.note?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [labSubmissions, searchQuery]);

  // Stats calculation
  const totalItems = labSubmissions.length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 via-slate-900/80 to-slate-900/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Personal Showcase</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Student Learning Portfolio
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Showcase your creative laboratory projects, graphic media artifacts, and track instructor feedback on your submitted assignments.
            </p>
          </div>
        </div>

        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Artifacts</span>
            <FolderArchive className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{totalItems}</div>
          <p className="text-[11px] text-slate-500 mt-1">Labs &amp; creative projects</p>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Lab Submissions</span>
            <Beaker className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{labSubmissions.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Uploaded assignments</p>
        </Card>

      </div>

      {/* Filter and Category Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artifacts, titles, notes..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setCategoryTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              categoryTab === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            All Works ({totalItems})
          </button>
          <button
            onClick={() => setCategoryTab('labs')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              categoryTab === 'labs'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Laboratory Files ({labSubmissions.length})
          </button>
        </div>
      </div>

      {/* ── Section: Laboratory Submissions ─────────────────────────────── */}
      {(categoryTab === 'all' || categoryTab === 'labs') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Beaker className="w-5 h-5 text-emerald-400" />
              Laboratory Submissions
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
              {filteredLabs.length} project{filteredLabs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {labsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
              <AetherSpinner className="w-5 h-5 text-emerald-400" /> Loading laboratory submissions…
            </div>
          ) : filteredLabs.length === 0 ? (
            <Card className="bg-slate-900/50 border-slate-800 p-8 text-center rounded-2xl">
              <Beaker className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-slate-300 font-medium text-sm">No laboratory submissions found</p>
              <p className="text-slate-500 text-xs mt-1">Complete an assigned laboratory to have your work showcased here.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredLabs.map((sub) => {
                const isGraded = sub.grade !== null && sub.grade !== undefined;
                return (
                  <Card
                    key={sub.id}
                    className="bg-slate-900/80 border-slate-800 overflow-hidden hover:border-emerald-500/40 transition-all flex flex-col justify-between rounded-2xl shadow-md"
                  >
                    {/* Media Thumbnail */}
                    <div
                      className="relative w-full h-44 bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer group"
                      onClick={() => setViewingSub(sub)}
                    >
                      {sub.fileType.startsWith('video/') ? (
                        <video
                          src={previewUrls[sub.id]}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={previewUrls[sub.id]}
                          alt={sub.fileName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute top-2.5 right-2.5">
                        <span className="bg-black/80 rounded-lg px-2 py-1 text-[10px] font-bold text-white flex items-center gap-1 backdrop-blur-sm">
                          {sub.fileType.startsWith('video/') ? (
                            <FileVideo className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          {sub.fileType.startsWith('video/') ? 'Video' : 'Image'}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-white truncate text-sm">{sub.labTitle}</h3>
                          {isGraded ? (
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                              {sub.grade}/100
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                              Under Review
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 truncate">{sub.fileName}</p>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </div>

                        {sub.note && (
                          <p className="text-xs text-slate-300 line-clamp-2 italic bg-slate-950/40 p-2 rounded-lg">
                            "{sub.note}"
                          </p>
                        )}

                        {sub.feedback && (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">
                              Instructor Feedback
                            </span>
                            <p className="text-xs text-slate-200 line-clamp-2">{sub.feedback}</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-slate-400 hover:text-white h-8 px-2"
                          onClick={() => handleShare(sub.labTitle)}
                        >
                          <Share2 className="w-3.5 h-3.5 mr-1" />
                          Share
                        </Button>

                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-semibold"
                          onClick={() => setViewingSub(sub)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Preview Modal for Lab Submission ────────────────── */}
      {viewingSub && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setViewingSub(null)}
        >
          <Card
            className="bg-slate-900 border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <h2 className="text-base font-bold text-white">{viewingSub.labTitle}</h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white" onClick={() => setViewingSub(null)}>
                ✕
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center min-h-[220px]">
                {viewingSub.fileType.startsWith('video/') ? (
                  <video src={previewUrls[viewingSub.id]} controls className="w-full max-h-80 object-contain" />
                ) : (
                  <img src={previewUrls[viewingSub.id]} alt={viewingSub.fileName} className="w-full max-h-80 object-contain" />
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{viewingSub.fileName}</span>
                <span>Submitted {new Date(viewingSub.submittedAt).toLocaleString()}</span>
              </div>

              {viewingSub.note && (
                <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Your Submission Note</span>
                  <p className="text-xs text-slate-200">{viewingSub.note}</p>
                </div>
              )}

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Grading Status</span>
                  <span className="text-sm font-extrabold text-emerald-300">
                    {viewingSub.grade !== null ? `${viewingSub.grade} / 100` : 'Pending Instructor Review'}
                  </span>
                </div>
                {viewingSub.feedback ? (
                  <p className="text-xs text-slate-200 mt-2 leading-relaxed">"{viewingSub.feedback}"</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No instructor comments yet.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
