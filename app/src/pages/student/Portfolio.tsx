import { useState, useEffect } from 'react';
import { Share2, Download, Trash2, Eye, Beaker, Calendar, FileVideo, ImageIcon } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getUserDesigns } from '@/components/laboratories/CanvaDesignStudio';
import { useAuthStore } from '@/stores/authStore';
import { authFetch } from '@/lib/authFetch';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';

interface PortfolioDesign {
  id: string;
  title: string;
  prompt: string;
  notes: string;
  completedAt: string;
  url: string;
  thumbnail?: string;
}

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

/**
 * Portfolio Component
 * Displays student's created designs and creative work
 * Allows sharing and showcasing of learning outcomes
 */
export function Portfolio() {
  const { user } = useAuthStore();
  const [designs, setDesigns] = useState<PortfolioDesign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState<PortfolioDesign | null>(null);
  const [filter, setFilter] = useState<'all' | 'recent' | 'favorite'>('all');
  const [labSubmissions, setLabSubmissions] = useState<LabSubmission[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [viewingSub, setViewingSub] = useState<LabSubmission | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    if (labSubmissions.length === 0) return;

    Promise.all(labSubmissions.map(async (submission) => {
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
      if (!cancelled) {
        setPreviewUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
      }
    });

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [labSubmissions]);

  useEffect(() => {
    // Load Canva designs from localStorage
    const loadDesigns = async () => {
      try {
        setIsLoading(true);
        const designData = getUserDesigns(user?.year_level);
        setDesigns(designData);
      } catch (error) {
        console.error('Error loading portfolio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Load lab file submissions from API
    const loadLabSubs = async () => {
      try {
        setLabsLoading(true);
        const res = await authFetch('/laboratory-submissions/my-files', { cache: 'no-store' });
        if (!res.ok) return;
        const map: Record<string, any> = await res.json();
        const normalized = Object.values(map).map((row: any) => ({
          ...row,
          grade: row.grade !== undefined && row.grade !== null && row.grade !== ''
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
        // offline — show nothing
      } finally {
        setLabsLoading(false);
      }
    };

    loadDesigns();
    loadLabSubs();

    const refreshOnReturn = () => loadLabSubs();
    window.addEventListener('focus', refreshOnReturn);
    return () => window.removeEventListener('focus', refreshOnReturn);
  }, [user?.year_level]);

  const handleDelete = (designId: string) => {
    if (confirm('Are you sure you want to delete this design?')) {
      const updatedDesigns = designs.filter(d => d.id !== designId);
      setDesigns(updatedDesigns);
      localStorage.setItem('userDesigns', JSON.stringify(updatedDesigns));
    }
  };

  const handleShare = (design: PortfolioDesign) => {
    const shareUrl = `${window.location.origin}/portfolio/${design.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => toast.success('Portfolio link copied to clipboard'))
        .catch(() => toast.error('Could not copy link — please copy manually'));
    } else {
      toast.info(shareUrl);
    }
  };

  const handleDownload = (design: PortfolioDesign) => {
    try {
      const url = design.thumbnail || design.url;
      if (!url) {
        toast.error('Nothing to download for this design');
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = `${design.title || 'portfolio-design'}.png`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloading "${design.title}"`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Download failed');
    }
  };

  const filteredDesigns = designs.filter(design => {
    if (filter === 'recent') {
      const recent = new Date(design.completedAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return recent >= thirtyDaysAgo;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Student Portfolio</h1>
          <p className="text-slate-400 mt-2">Showcase your creative work and learning journey</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Total Designs</p>
            <p className="text-2xl font-bold text-violet-400">{designs.length}</p>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Lab Submissions</p>
            <p className="text-2xl font-bold text-emerald-400">{labSubmissions.length}</p>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Recent (30 days)</p>
            <p className="text-2xl font-bold text-pink-400">
              {designs.filter(d => {
                const recent = new Date(d.completedAt);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return recent >= thirtyDaysAgo;
              }).length}
            </p>
          </Card>
        </div>
      </div>

      {/* ── Lab File Submissions ─────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Laboratory Submissions</h2>
          {!labsLoading && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
              {labSubmissions.length}
            </span>
          )}
        </div>

        {labsLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <AetherSpinner className="w-4 h-4" /> Loading submissions…
          </div>
        ) : labSubmissions.length === 0 ? (
          <Card className="bg-slate-900/60 border-slate-800 p-6 text-center">
            <p className="text-slate-400 text-sm">No lab submissions yet. Complete a laboratory to see your work here.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {labSubmissions.map(sub => (
              <Card
                key={sub.id}
                className="bg-slate-900/60 border-slate-800 overflow-hidden hover:border-emerald-500/30 transition-all cursor-pointer group"
                onClick={() => setViewingSub(sub)}
              >
                {/* Thumbnail */}
                <div className="relative w-full h-40 bg-slate-800 flex items-center justify-center overflow-hidden">
                  {sub.fileType.startsWith('video/') ? (
                    <video
                      src={previewUrls[sub.id]}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <img src={previewUrls[sub.id]} alt={sub.fileName} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute top-2 right-2">
                    {sub.fileType.startsWith('video/') ? (
                      <span className="bg-black/70 rounded px-1.5 py-0.5 text-xs text-white flex items-center gap-1">
                        <FileVideo className="w-3 h-3" /> Video
                      </span>
                    ) : (
                      <span className="bg-black/70 rounded px-1.5 py-0.5 text-xs text-white flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Photo
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-white truncate text-sm">{sub.labTitle}</h3>
                  <p className="text-xs text-slate-500 truncate">{sub.fileName}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" />
                    {new Date(sub.submittedAt).toLocaleDateString()}
                  </div>
                  {sub.note && (
                    <p className="text-xs text-slate-400 line-clamp-2 italic">"{sub.note}"</p>
                  )}
                  <p className="text-xs text-emerald-400">
                    {sub.grade !== null ? `Grade: ${sub.grade}/100` : 'Not graded yet'}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview modal for lab submission ────────────────── */}
      {viewingSub && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingSub(null)}
        >
          <Card
            className="bg-slate-900 border-slate-800 w-full max-w-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{viewingSub.labTitle}</h2>
                <Button variant="outline" size="sm" className="border-slate-600" onClick={() => setViewingSub(null)}>
                  Close
                </Button>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                {viewingSub.fileType.startsWith('video/') ? (
                  <video src={previewUrls[viewingSub.id]} controls className="w-full max-h-80 object-contain" />
                ) : (
                  <img src={previewUrls[viewingSub.id]} alt={viewingSub.fileName} className="w-full max-h-80 object-contain" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{viewingSub.fileName}</span>
                <span>{new Date(viewingSub.submittedAt).toLocaleString()}</span>
              </div>
              {viewingSub.note && (
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-xs text-slate-300">{viewingSub.note}</p>
                </div>
              )}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-sm font-semibold text-emerald-300">
                  {viewingSub.grade !== null ? `Grade: ${viewingSub.grade}/100` : 'Not graded yet'}
                </p>
                {viewingSub.feedback && <p className="mt-1 text-sm text-slate-300">{viewingSub.feedback}</p>}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
