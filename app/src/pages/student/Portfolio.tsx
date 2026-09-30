import { useState, useEffect, useMemo } from 'react';
import {
  Share2,
  Eye,
  Beaker,
  Calendar,
  FileVideo,
  ImageIcon,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { AetherLoader } from '@/components/AetherLoader';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { authFetch } from '@/lib/authFetch';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';
import { cn } from '@/lib/utils';

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

interface LaboratorySummary {
  id: string;
  title: string;
}

export function Portfolio() {
  const { user } = useAuthStore();
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';
  const [categoryTab, setCategoryTab] = useState<'all' | 'labs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [labSubmissions, setLabSubmissions] = useState<LabSubmission[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
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
        const activeLaboratories = laboratoriesData
          ? (laboratoriesData.data ?? [])
            .filter((laboratory: any) => laboratory.status !== 'archived')
            .map((laboratory: any) => ({
              id: String(laboratory.id),
              title: laboratory.title || laboratory.name || `Laboratory ${laboratory.id}`,
            }))
          : [];
        setLaboratories(activeLaboratories);
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

  const filteredLaboratories = useMemo(() => {
    if (!searchQuery.trim()) return laboratories;
    const q = searchQuery.toLowerCase().trim();
    return laboratories.filter((lab) => {
      const matchesTitle = lab.title?.toLowerCase().includes(q);
      const sub = labSubmissions.find((item) => item.labId === lab.id);
      const matchesFile = sub?.fileName?.toLowerCase().includes(q);
      const matchesNote = sub?.note?.toLowerCase().includes(q);
      return matchesTitle || matchesFile || matchesNote;
    });
  }, [laboratories, labSubmissions, searchQuery]);

  // Stats calculation
  const totalItems = labSubmissions.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn('text-2xl sm:text-3xl font-bold tracking-tight', isLightMode ? 'text-slate-900' : 'text-white')}>
            Laboratory Result
          </h1>
          <p className={cn('text-sm mt-1', isLightMode ? 'text-slate-500' : 'text-slate-400')}>
            Track your laboratory submissions, grades, and instructor evaluations.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={cn(
          'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 p-4 rounded-2xl border transition-all shadow-sm',
          isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/70 border-slate-800'
        )}
      >
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search laboratory title, file name, or submission notes..."
            className={cn(
              'w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl outline-none transition-all border',
              isLightMode
                ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10'
                : 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
            )}
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

        <div className="flex items-center gap-2 overflow-x-auto shrink-0">
          {searchQuery && (
            <span className={cn('text-xs mr-2 whitespace-nowrap', isLightMode ? 'text-slate-500' : 'text-slate-400')}>
              Showing <span className={cn('font-semibold', isLightMode ? 'text-slate-900' : 'text-white')}>{filteredLabs.length}</span> matching
            </span>
          )}
          <button
            onClick={() => setCategoryTab('all')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
              categoryTab === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : isLightMode
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            All Works ({totalItems})
          </button>
          <button
            onClick={() => setCategoryTab('labs')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
              categoryTab === 'labs'
                ? 'bg-emerald-600 text-white shadow-sm'
                : isLightMode
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            Laboratory Files ({labSubmissions.length})
          </button>
        </div>
      </div>

      {/* ── Section: Laboratory Results ─────────────────────────────────── */}
      <Card
        className={cn(
          'overflow-hidden rounded-2xl border p-0',
          isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'border-slate-800 bg-slate-900/60'
        )}
      >
        <div className={cn('border-b px-5 py-4', isLightMode ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800')}>
          <h2 className={cn('flex items-center gap-2 text-lg font-bold', isLightMode ? 'text-slate-900' : 'text-white')}>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Laboratory Results
          </h2>
          <p className={cn('mt-1 text-xs', isLightMode ? 'text-slate-500' : 'text-slate-400')}>Your laboratory progress and results</p>
        </div>
        {labsLoading ? (
          <div className="p-5">
            <AetherLoader variant="table" count={3} label="Loading laboratory results..." />
          </div>
        ) : laboratories.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No laboratories available yet.</p>
        ) : filteredLaboratories.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            <Search className="mx-auto h-6 w-6 text-slate-400 opacity-60 mb-2" />
            No laboratories match "{searchQuery}"
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto max-h-[70vh] overflow-y-auto relative">
              <table className="w-full min-w-max text-left text-sm border-separate border-spacing-0">
                <thead className={cn('text-xs uppercase sticky top-0 z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.08)]', isLightMode ? 'bg-slate-50 text-slate-600' : 'bg-slate-900 text-slate-400')}>
                  <tr>
                    <th className={cn("sticky top-0 left-0 z-30 px-5 py-3 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]", isLightMode ? "bg-slate-50" : "bg-slate-900")}>Student</th>
                    {filteredLaboratories.map((laboratory) => (
                      <th key={laboratory.id} className={cn("min-w-40 px-5 py-3 sticky top-0", isLightMode ? "bg-slate-50" : "bg-slate-900")}>{laboratory.title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={cn('divide-y', isLightMode ? 'divide-slate-100' : 'divide-slate-800/60')}>
                  <tr className={isLightMode ? 'text-slate-700' : 'text-slate-300'}>
                    <td className={cn("sticky left-0 z-10 px-5 py-4 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]", isLightMode ? "bg-white" : "bg-slate-900")}>
                      <div className={cn('font-medium', isLightMode ? 'text-slate-900' : 'text-white')}>{user?.full_name || 'Student'}</div>
                      <div className="text-xs text-slate-500">{user?.email || ''}</div>
                    </td>
                    {filteredLaboratories.map((laboratory) => {
                      const submission = labSubmissions.find((item) => item.labId === laboratory.id);
                      const finished = Boolean(submission);
                      return (
                        <td key={laboratory.id} className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${finished
                            ? (isLightMode ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300')
                            : (isLightMode ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-slate-600 bg-slate-800/80 text-slate-300')}`}>
                            {finished ? 'Finished' : 'Untaken'}
                          </span>
                          {submission && submission.grade !== null && submission.grade !== undefined && (
                            <div className={cn('mt-1 font-semibold', isLightMode ? 'text-emerald-700' : 'text-emerald-400')}>{submission.grade}/100</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View */}
            <div className="block sm:hidden p-4 space-y-3">
              <div className={cn('sticky top-0 z-10 p-3 rounded-xl border flex items-center justify-between backdrop-blur-md shadow-sm', isLightMode ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-slate-800')}>
                <div>
                  <p className={cn('font-semibold text-sm', isLightMode ? 'text-slate-900' : 'text-white')}>{user?.full_name || 'Student'}</p>
                  <p className="text-xs text-slate-500">{user?.email || ''}</p>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', isLightMode ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400')}>
                  {labSubmissions.length}/{filteredLaboratories.length} Completed
                </span>
              </div>

              <div className="space-y-2">
                {filteredLaboratories.map((laboratory) => {
                  const submission = labSubmissions.find((item) => item.labId === laboratory.id);
                  const finished = Boolean(submission);
                  const isGraded = submission?.grade !== null && submission?.grade !== undefined;

                  return (
                    <div
                      key={laboratory.id}
                      className={cn(
                        'p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors',
                        isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className={cn('font-medium text-xs truncate', isLightMode ? 'text-slate-900' : 'text-white')}>
                          {laboratory.title}
                        </h4>
                        {submission?.submittedAt && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${finished
                          ? (isLightMode ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300')
                          : (isLightMode ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-slate-600 bg-slate-800/80 text-slate-300')}`}>
                          {finished ? 'Finished' : 'Untaken'}
                        </span>
                        {isGraded && (
                          <span className={cn('text-xs font-bold', isLightMode ? 'text-emerald-700' : 'text-emerald-400')}>
                            {submission.grade}/100
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Section: Laboratory Submissions ─────────────────────────────── */}
      {(categoryTab === 'all' || categoryTab === 'labs') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={cn('text-lg font-bold flex items-center gap-2', isLightMode ? 'text-slate-900' : 'text-white')}>
              <Beaker className="w-5 h-5 text-emerald-500" />
              Laboratory Submissions
            </h2>
            <span
              className={cn(
                'text-xs px-2.5 py-1 rounded-full font-semibold border',
                isLightMode
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              )}
            >
              {filteredLabs.length} project{filteredLabs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {labsLoading ? (
            <AetherLoader variant="cards" count={3} label="Loading laboratory submissions..." />
          ) : filteredLabs.length === 0 ? (
            <Card
              className={cn(
                'p-8 text-center rounded-2xl border',
                isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-slate-900/50 border-slate-800'
              )}
            >
              <Beaker className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
              <p className={cn('font-medium text-sm', isLightMode ? 'text-slate-700' : 'text-slate-300')}>No laboratory submissions found</p>
              <p className="text-slate-500 text-xs mt-1">Complete an assigned laboratory to have your work showcased here.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredLabs.map((sub) => {
                const isGraded = sub.grade !== null && sub.grade !== undefined;
                return (
                  <Card
                    key={sub.id}
                    className={cn(
                      'overflow-hidden transition-all flex flex-col justify-between rounded-2xl shadow-md border',
                      isLightMode
                        ? 'bg-white border-slate-200/80 hover:border-emerald-500/40 shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40'
                    )}
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
                          <h3 className={cn('font-bold truncate text-sm', isLightMode ? 'text-slate-900' : 'text-white')}>{sub.labTitle}</h3>
                          {isGraded ? (
                            <span
                              className={cn(
                                'text-xs font-bold px-2 py-0.5 rounded-full border shrink-0',
                                isLightMode ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              )}
                            >
                              {sub.grade}/100
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0',
                                isLightMode ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                              )}
                            >
                              Under Review
                            </span>
                          )}
                        </div>

                        <p className={cn('text-[11px] truncate', isLightMode ? 'text-slate-500' : 'text-slate-400')}>{sub.fileName}</p>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </div>

                        {sub.note && (
                          <p className={cn('text-xs line-clamp-2 italic p-2 rounded-lg', isLightMode ? 'text-slate-700 bg-slate-50 border border-slate-100' : 'text-slate-300 bg-slate-950/40')}>
                            "{sub.note}"
                          </p>
                        )}

                        {sub.feedback && (
                          <div className={cn('rounded-xl border p-2.5', isLightMode ? 'border-emerald-200 bg-emerald-50/70' : 'border-emerald-500/20 bg-emerald-500/5')}>
                            <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-0.5', isLightMode ? 'text-emerald-800' : 'text-emerald-400')}>
                              Instructor Feedback
                            </span>
                            <p className={cn('text-xs line-clamp-2', isLightMode ? 'text-slate-800' : 'text-slate-200')}>{sub.feedback}</p>
                          </div>
                        )}
                      </div>

                      <div className={cn('pt-2 border-t flex items-center justify-between', isLightMode ? 'border-slate-100' : 'border-slate-800')}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn('text-xs h-8 px-2', isLightMode ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white')}
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
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 backdrop-blur-sm"
          onClick={() => setViewingSub(null)}
        >
          <Card
            className={cn(
              'w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border',
              isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn('flex items-center justify-between px-6 py-4 border-b', isLightMode ? 'border-slate-100 bg-slate-50/70' : 'border-slate-800 bg-slate-950/40')}>
              <h2 className={cn('text-base font-bold', isLightMode ? 'text-slate-900' : 'text-white')}>{viewingSub.labTitle}</h2>
              <Button variant="ghost" size="sm" className={cn('h-8 w-8 p-0', isLightMode ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white')} onClick={() => setViewingSub(null)}>
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

              <div className="flex items-center justify-between text-xs">
                <span className={isLightMode ? 'text-slate-600' : 'text-slate-400'}>{viewingSub.fileName}</span>
                <span className={isLightMode ? 'text-slate-500' : 'text-slate-400'}>Submitted {new Date(viewingSub.submittedAt).toLocaleString()}</span>
              </div>

              {viewingSub.note && (
                <div className={cn('rounded-xl p-3 border', isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-800')}>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', isLightMode ? 'text-slate-500' : 'text-slate-400')}>Your Submission Note</span>
                  <p className={cn('text-xs', isLightMode ? 'text-slate-800' : 'text-slate-200')}>{viewingSub.note}</p>
                </div>
              )}

              <div className={cn('rounded-2xl border p-4', isLightMode ? 'border-emerald-200 bg-emerald-50/70' : 'border-emerald-500/20 bg-emerald-500/10')}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-xs font-bold uppercase tracking-wider', isLightMode ? 'text-emerald-800' : 'text-emerald-400')}>Grading Status</span>
                  <span className={cn('text-sm font-extrabold', isLightMode ? 'text-emerald-700' : 'text-emerald-300')}>
                    {viewingSub.grade !== null ? `${viewingSub.grade} / 100` : 'Pending Instructor Review'}
                  </span>
                </div>
                {viewingSub.feedback ? (
                  <p className={cn('text-xs mt-2 leading-relaxed', isLightMode ? 'text-slate-800' : 'text-slate-200')}>"{viewingSub.feedback}"</p>
                ) : (
                  <p className={cn('text-xs italic', isLightMode ? 'text-slate-500' : 'text-slate-400')}>No instructor comments yet.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
