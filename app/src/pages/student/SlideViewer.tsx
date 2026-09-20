import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ThumbsUp,
  Lock,
  Download,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Video,
  Link as LinkIcon,
  ExternalLink,
  Presentation,
  FileText,
  Sparkles,
  ArrowRight,
  FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { DocumentViewer } from '@/components/DocumentViewer';
import { PDFViewer } from '@/components/PDFViewer';
import { authFetch } from '@/lib/authFetch';
import { downloadLessonAsPDF } from '@/lib/downloadUtils';
import { API_BASE_URL, resolveBackendAssetUrl } from '@/lib/apiConfig';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { AetherLoader } from '@/components/AetherLoader';

interface Slide {
  id?: string;
  slideNumber: number;
  title: string;
  content: string;
  summary: string;
  keyPoints: string[];
}

interface SlideViewerProps {
  lessonId: string;
  lessonTitle: string;
  lesson?: any;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  likes: number;
  userLiked: boolean;
  slideNumber?: number;
}

export function SlideViewer({ lessonId, lessonTitle, lesson: initialLesson }: SlideViewerProps) {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lesson, setLesson] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  
  // UI Enhancements
  const [theaterMode, setTheaterMode] = useState(false);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(true);
  const [activeTab, setActiveTab] = useState<'slides' | 'video' | 'app'>('slides');

  const { user } = useAuthStore();
  const completionKey = user?.id ? `lesson-completed:${user.id}:${lessonId}` : '';
  const [completed, setCompleted] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => {
    if (!completionKey) return;
    // Optimistic from cache
    setCompleted(localStorage.getItem(completionKey) === 'true');
    // Authoritative from backend
    (async () => {
      try {
        const r = await authFetch('/users/lesson-progress/me');
        const j = await r.json();
        if (j?.success) {
          const ids: string[] = j.data?.lessonIds ?? [];
          const isDone = ids.includes(lessonId);
          setCompleted(isDone);
          if (isDone) localStorage.setItem(completionKey, 'true');
        }
      } catch {
        /* keep cached value */
      }
    })();
  }, [completionKey, lessonId]);

  useEffect(() => {
    loadSlides();
    loadComments();
    setCurrentSlide(0);
    setActiveTab('slides');
  }, [lessonId]);

  // Keyboard navigation & Shortcuts (Arrows & Theater mode)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowRight') {
        if (slides.length > 0 && currentSlide < slides.length - 1) {
          setCurrentSlide((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentSlide > 0) {
          setCurrentSlide((prev) => prev - 1);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        setTheaterMode((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (theaterMode) setTheaterMode(false);
      }
    },
    [slides.length, currentSlide, theaterMode]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleMarkDone = async () => {
    if (!completionKey) {
      toast.error('You must be signed in to mark this lesson as done');
      return;
    }
    setSavingProgress(true);
    localStorage.setItem(completionKey, 'true');
    localStorage.setItem(`${completionKey}:at`, new Date().toISOString());
    setCompleted(true);
    try {
      const r = await authFetch('/users/lesson-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, completed: true }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error?.message || 'Failed to save');
      toast.success('🎉 Lesson marked as completed! Excellent work!');
    } catch (err: any) {
      console.error('Save lesson progress failed:', err);
      toast.error('Saved locally, but couldn’t reach the server');
    } finally {
      setSavingProgress(false);
    }
  };

  const loadSlides = async () => {
    try {
      setLoading(true);
      setError('');

      if (initialLesson && String(initialLesson.id) === String(lessonId)) {
        const isPdfLesson = Boolean(
          initialLesson.pdfUrl || initialLesson.pdf_url ||
          initialLesson.originalFormat === 'pdf' || initialLesson.original_format === 'pdf'
        );
        const foundSlides = Array.isArray(initialLesson.slides)
          ? initialLesson.slides.map((slide: any, idx: number) => ({
              id: slide.slideNumber || idx,
              slideNumber: slide.slideNumber || idx + 1,
              title: slide.title || 'Untitled Slide',
              content: slide.content || '',
              summary: slide.summary || '',
              keyPoints: Array.isArray(slide.keyPoints) ? slide.keyPoints : [],
            }))
          : [];

        setLesson(initialLesson);
        setSlides(foundSlides);
        if (isPdfLesson) {
          setPdfUrl(resolveBackendAssetUrl(initialLesson.pdfUrl || initialLesson.pdf_url || ''));
        }
        setLoading(false);
        return;
      }

      const lessonResponse = await authFetch(`${API_BASE_URL}/lessons/by-id/${lessonId}`, { cache: 'no-store' });
      const lessonData = await lessonResponse.json();
      if (!lessonResponse.ok || !lessonData.success || !lessonData.data) {
        throw new Error(lessonData.error?.message || 'Failed to fetch lesson');
      }

      const foundLesson = lessonData.data;
      const isPdfLesson = Boolean(
        foundLesson.pdfUrl || foundLesson.pdf_url || foundLesson.originalFormat === 'pdf' || foundLesson.original_format === 'pdf'
      );

      if (isPdfLesson) {
        const resolvedPdfUrl = resolveBackendAssetUrl(foundLesson.pdfUrl || foundLesson.pdf_url || '');
        setPdfUrl(resolvedPdfUrl);
        setLesson(foundLesson);
        setSlides([]);
        setLoading(false);
        return;
      }

      let foundSlides: Slide[] = [];
      if (Array.isArray(foundLesson.slides) && foundLesson.slides.length > 0) {
        foundSlides = foundLesson.slides.map((slide: any, idx: number) => ({
          id: slide.slideNumber || idx,
          slideNumber: slide.slideNumber || idx + 1,
          title: slide.title || 'Untitled Slide',
          content: slide.content || '',
          summary: slide.summary || '',
          keyPoints: Array.isArray(slide.keyPoints) ? slide.keyPoints : [],
        }));
      }

      if (foundSlides.length === 0 && !foundLesson?.pdfUrl && !foundLesson?.pdf_url && !foundLesson?.originalFormat && !foundLesson?.original_format) {
        setError('No slides found for this lesson.');
      } else {
        setSlides(foundSlides);
        setLesson(foundLesson);
      }
    } catch (err: any) {
      console.error('Error loading slides:', err);
      setError(err.message || 'Failed to load slides');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = () => {
    try {
      const savedComments = localStorage.getItem(`comments_${lessonId}`);
      if (savedComments) {
        setComments(JSON.parse(savedComments));
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error('Error loading comments:', err);
      setComments([]);
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const newCommentObj: Comment = {
        id: uuidv4(),
        author: user?.full_name || 'You',
        content: newComment.trim(),
        timestamp: new Date().toLocaleString(),
        likes: 0,
        userLiked: false,
        slideNumber: currentSlide + 1,
      };

      const updatedComments = [...comments, newCommentObj];
      setComments(updatedComments);
      localStorage.setItem(`comments_${lessonId}`, JSON.stringify(updatedComments));
      setNewComment('');
      toast.success('Comment posted!');
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  };

  const handleLikeComment = (commentId: string) => {
    try {
      const updatedComments = comments.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            likes: c.userLiked ? c.likes - 1 : c.likes + 1,
            userLiked: !c.userLiked,
          };
        }
        return c;
      });

      setComments(updatedComments);
      localStorage.setItem(`comments_${lessonId}`, JSON.stringify(updatedComments));
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  };

  const handleDownloadPDF = async () => {
    if (lesson) {
      try {
        await downloadLessonAsPDF(lesson);
        toast.success('Lesson downloaded as PDF!');
      } catch (err: any) {
        toast.error('Failed to download PDF: ' + (err?.message || 'Unknown error'));
      }
    }
  };

  const handleCopySlideNotes = () => {
    const slide = slides[currentSlide];
    if (!slide) return;

    const notes = [
      `# ${lessonTitle} - Slide ${currentSlide + 1}: ${slide.title}`,
      '',
      slide.content || '',
      slide.summary ? `\nSummary:\n${slide.summary}` : '',
      slide.keyPoints && slide.keyPoints.length > 0
        ? `\nKey Takeaways:\n${slide.keyPoints.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(notes);
    setCopiedNotes(true);
    toast.success('Slide study notes copied to clipboard!');
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  if (loading) {
    return <AetherLoader label="Projecting your lesson slides" />;
  }

  if (error) {
    return (
      <div className="text-center p-12 bg-slate-900/40 rounded-2xl border border-slate-800">
        <p className="text-red-400 font-medium">{error}</p>
      </div>
    );
  }

  const lessonAssetUrl = pdfUrl || lesson?.pdfUrl || lesson?.pdf_url || '';
  const normalizedLessonPath = String(lessonAssetUrl || lesson?.filePath || lesson?.file_path || lesson?.fileName || lesson?.file_name || '');
  const isPdfLesson = Boolean(
    lesson?.pdfUrl ||
      lesson?.pdf_url ||
      lesson?.originalFormat === 'pdf' ||
      lesson?.original_format === 'pdf' ||
      /\.pdf$/i.test(normalizedLessonPath) ||
      pdfUrl
  );
  const isPptLesson = Boolean(
    lesson?.originalFormat === 'ppt' ||
      lesson?.original_format === 'ppt' ||
      lesson?.originalFormat === 'pptx' ||
      lesson?.original_format === 'pptx' ||
      /\.pptx?$/i.test(normalizedLessonPath) ||
      /\.pptx?$/i.test(String(pdfUrl || ''))
  );

  // PDF Document Mode
  if (isPdfLesson && !isPptLesson) {
    const directPdfUrl = pdfUrl || resolveBackendAssetUrl(lesson?.pdfUrl || lesson?.pdf_url || '');
    const pdfViewerUrl = lessonId ? `${API_BASE_URL}/lessons/${lessonId}/pdf` : directPdfUrl;
    return (
      <div className="space-y-3">
        {/* Aesthetic Document Status & Completion Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              Course Reading Material
            </span>
            {completed && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Completed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleMarkDone}
              disabled={completed || savingProgress}
              size="sm"
              className={
                completed
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold text-xs cursor-default shadow-none'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 font-semibold text-xs transition-all'
              }
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {completed ? 'Lesson Completed ✓' : 'Mark as Done'}
            </Button>

            <a
              href={directPdfUrl || pdfViewerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>
          </div>
        </div>

        {pdfViewerUrl ? (
          <PDFViewer url={pdfViewerUrl} onDownload={handleDownloadPDF} />
        ) : (
          <div className="p-12 text-center text-slate-400">PDF preview is not available for this lesson.</div>
        )}
      </div>
    );
  }

  // PowerPoint Mode
  if (isPptLesson) {
    const pptSourceUrl = pdfUrl || lesson?.pdfUrl || lesson?.pdf_url || '';
    const resolvedPptUrl = resolveBackendAssetUrl(pptSourceUrl);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
              <Presentation className="w-3.5 h-3.5 text-cyan-500" />
              PowerPoint Presentation
            </span>
            {completed && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Completed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleMarkDone}
              disabled={completed || savingProgress}
              size="sm"
              className={
                completed
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold text-xs cursor-default shadow-none'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 font-semibold text-xs'
              }
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {completed ? 'Completed ✓' : 'Mark as Done'}
            </Button>
            <a
              href={resolvedPptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PPT</span>
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl">
          <DocumentViewer lessonId={lessonId} documentUrl={pptSourceUrl} title={lessonTitle} fileType="pptx" />
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="text-center p-12 bg-slate-900/40 border border-slate-800 rounded-2xl">
        <Lock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">No slides available for this lesson yet</p>
        <p className="text-slate-500 text-sm mt-1">Your instructor is still preparing learning materials for this topic.</p>
      </div>
    );
  }

  const slide = slides[currentSlide];
  const slideComments = comments.filter((c) => !c.slideNumber || c.slideNumber === currentSlide + 1);
  const videoUrl = lesson?.video_url || lesson?.videoUrl;
  const appLink = lesson?.app_link || lesson?.appLink;
  const appName = lesson?.app_name || lesson?.appName;
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-4 overflow-x-hidden">
      {/* Media Switcher Tab Header (if video or tool attached) */}
      {(videoUrl || appLink) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('slides')}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all sm:flex-none sm:px-4 ${
              activeTab === 'slides'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Presentation className="h-4 w-4" />
            <span>Interactive Slides</span>
          </button>

          {videoUrl && (
            <button
              onClick={() => setActiveTab('video')}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all sm:flex-none sm:px-4 ${
                activeTab === 'video'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Video className="h-4 w-4" />
              <span>Video Lecture</span>
            </button>
          )}

          {appLink && (
            <button
              onClick={() => setActiveTab('app')}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all sm:flex-none sm:px-4 ${
                activeTab === 'app'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <LinkIcon className="h-4 w-4" />
              <span>{appName || 'Interactive Tool'}</span>
            </button>
          )}
        </div>
      )}

      {/* Video Lecture Tab */}
      {activeTab === 'video' && videoUrl && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Class Video Lecture</h3>
              <p className="text-xs text-slate-400">Stream and follow along with your instructor</p>
            </div>
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </a>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-2xl">
            {/* 16:9 aspect ratio — fills width on mobile, caps at natural video height on desktop */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <video
                src={videoUrl}
                controls
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Interactive Tool Tab */}
      {activeTab === 'app' && appLink && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{appName || 'Interactive Practice Tool'}</h3>
              <p className="text-xs text-slate-400">Hands-on application linked for this lesson</p>
            </div>
            <a
              href={appLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-md transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Full Window
            </a>
          </div>
          {/* Responsive iframe — 16:9 on mobile, tall on desktop */}
          <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <div className="relative w-full sm:h-[550px]" style={{ paddingBottom: 'clamp(0px, 56.25vw, 550px)' }}>
              <iframe
                src={appLink}
                title={appName || 'Interactive Tool'}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Slides Tab */}
      {activeTab === 'slides' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Slide Viewer Canvas */}
          <div className={showDiscussion ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
            <Card className="min-w-0 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950 border-slate-800/90 p-4 sm:p-8 min-h-[14rem] sm:min-h-[30rem] lg:min-h-[calc(100vh-18rem)] flex flex-col justify-between shadow-2xl backdrop-blur-md">
              {/* Header Bar */}
              <div className="pb-4 border-b border-slate-800/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-violet-600/20 px-2.5 py-0.5 text-xs font-bold text-violet-300 border border-violet-500/20">
                        Slide {currentSlide + 1} of {slides.length}
                      </span>
                      {completed && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </div>
                    <h2 className="break-words text-2xl sm:text-3xl font-extrabold text-white mt-2 tracking-tight">
                      {slide.title}
                    </h2>
                  </div>

                  {/* Actions Header */}
                  <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:flex-nowrap sm:gap-2">
                    <Button
                      onClick={handleCopySlideNotes}
                      size="sm"
                      variant="ghost"
                      className="h-8 flex-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 sm:flex-none"
                      title="Copy notes to clipboard"
                    >
                      {copiedNotes ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      <span>{copiedNotes ? 'Copied' : 'Copy'}</span>
                    </Button>

                    <Button
                      onClick={() => setTheaterMode(true)}
                      size="sm"
                      variant="ghost"
                      className="h-8 flex-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 sm:flex-none"
                      title="Cinema Mode (F)"
                    >
                      <Maximize2 className="w-3.5 h-3.5 mr-1" />
                      <span>Cinema</span>
                    </Button>

                    <Button
                      onClick={() => setShowDiscussion((prev) => !prev)}
                      size="sm"
                      variant="ghost"
                      className={`h-8 flex-1 text-xs hover:bg-slate-800 sm:flex-none ${showDiscussion ? 'text-violet-400' : 'text-slate-400 hover:text-white'}`}
                      title="Toggle discussion drawer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />
                      <span>Discussion ({slideComments.length})</span>
                    </Button>

                    <Button
                      onClick={handleDownloadPDF}
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs sm:flex-none"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>

              {/* Slide Body Content */}
              <div className="py-6 space-y-6 flex-grow">
                <div className="prose prose-invert max-w-none break-words">
                  <p className="text-slate-200 text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
                    {slide.content}
                  </p>
                </div>

                {/* Summary Card */}
                {slide.summary && (
                  <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400 mb-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Key Summary</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed italic">
                      {slide.summary}
                    </p>
                  </div>
                )}

                {/* Concept Cards */}
                {slide.keyPoints && slide.keyPoints.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Key Takeaways
                    </h4>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {slide.keyPoints.map((point, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 transition-all hover:border-slate-700"
                        >
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-violet-600/30 text-xs font-bold text-violet-300 border border-violet-500/30">
                            {idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm text-slate-200 leading-snug pt-0.5">
                            {point}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Celebratory Completion Banner (on last slide) */}
              {isLastSlide && (
                <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-600/10 to-teal-500/10 p-5 sm:p-6 shadow-lg">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 text-center sm:text-left">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">
                          {completed ? '🎉 Lesson Mastered!' : 'You reached the end of the lesson!'}
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {completed
                            ? 'Great job completing all slides. Test your knowledge or continue learning.'
                            : 'Click below to record your completion progress.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={handleMarkDone}
                        disabled={completed || savingProgress}
                        className={completed
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 cursor-default gap-1.5'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 gap-1.5'
                        }
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {completed ? 'Completed ✓' : 'Mark as Done'}
                      </Button>

                      <Button
                        onClick={() => navigate('/quizzes')}
                        variant="outline"
                        className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5 text-xs"
                      >
                        <span>Take Quiz</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        onClick={() => navigate('/laboratories')}
                        variant="outline"
                        className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5 text-xs"
                      >
                        <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Laboratories</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Bottom Controls & Slider Timeline */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                disabled={currentSlide === 0}
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-30 gap-1.5 text-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </Button>

              <div className="flex items-center gap-1.5 max-w-[280px] overflow-hidden">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentSlide ? 'bg-violet-500 w-8' : 'bg-slate-700 w-2 hover:bg-slate-600'
                    }`}
                    title={`Slide ${idx + 1}`}
                  />
                ))}
              </div>

              <Button
                onClick={() => setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))}
                disabled={currentSlide === slides.length - 1}
                className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-30 gap-1.5 text-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Progress Percentage Indicator */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>{Math.round(((currentSlide + 1) / slides.length) * 100)}% viewed</span>
              <span>Use keyboard <kbd className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300">←</kbd> <kbd className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300">→</kbd> or <kbd className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300">F</kbd></span>
            </div>
          </div>

          {/* Discussion Side Panel */}
          {showDiscussion && (
            <div className="lg:col-span-1">
              <Card className="bg-slate-900/80 border-slate-800 p-5 rounded-2xl sticky top-6 shadow-xl">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                    <MessageCircle className="w-4 h-4 text-violet-400" />
                    Slide {currentSlide + 1} Discussion
                  </h3>
                  <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold">
                    {slideComments.length}
                  </span>
                </div>

                {/* Comments List */}
                <div className="space-y-3 mb-4 max-h-[380px] overflow-y-auto pr-1">
                  {slideComments.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-slate-400 font-medium">No comments on this slide yet</p>
                      <p className="text-[11px] text-slate-500 mt-1">Have a question or insight? Share it below!</p>
                    </div>
                  ) : (
                    slideComments.map((comment) => (
                      <div key={comment.id} className="bg-slate-800/40 rounded-xl p-3 border border-slate-800">
                        <div className="flex items-start justify-between mb-1.5">
                          <p className="text-xs font-semibold text-violet-300">{comment.author}</p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(comment.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 mb-2 leading-relaxed">{comment.content}</p>
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className={`flex items-center gap-1.5 text-xs transition-colors ${
                            comment.userLiked ? 'text-violet-400 font-semibold' : 'text-slate-400 hover:text-violet-400'
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>{comment.likes}</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Form */}
                <form onSubmit={handlePostComment} className="space-y-2.5 pt-2 border-t border-slate-800">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Ask a question or share a thought on this slide..."
                    rows={2}
                    className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500 resize-none focus:border-violet-500"
                  />
                  <Button
                    type="submit"
                    disabled={!newComment.trim()}
                    size="sm"
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold"
                  >
                    Post Comment
                  </Button>
                </form>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Theater / Cinema Mode for Student */}
      {theaterMode && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#060b13] p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-violet-600/30 px-3 py-1 text-xs font-bold text-violet-300 border border-violet-500/40">
                Focus Mode
              </span>
              <h3 className="text-base font-semibold text-white truncate max-w-md">{lessonTitle}</h3>
              <span className="text-xs text-slate-400">
                Slide {currentSlide + 1} / {slides.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleCopySlideNotes}
                size="sm"
                variant="ghost"
                className="text-xs text-slate-400 hover:text-white"
              >
                {copiedNotes ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copiedNotes ? 'Copied' : 'Copy'}
              </Button>

              <Button
                onClick={() => setTheaterMode(false)}
                size="sm"
                className="bg-slate-800 hover:bg-slate-700 text-white gap-1.5 text-xs"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit Cinema (Esc)</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between overflow-y-auto max-w-4xl mx-auto w-full py-4 space-y-6">
            <div className="space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
                Slide {currentSlide + 1}
              </span>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {slide.title}
              </h1>

              <p className="text-lg sm:text-xl leading-relaxed text-slate-200">
                {slide.content}
              </p>

              {slide.summary && (
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-300 block mb-1">
                    Summary
                  </span>
                  <p className="text-base text-slate-200 leading-relaxed">{slide.summary}</p>
                </div>
              )}

              {slide.keyPoints && slide.keyPoints.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  {slide.keyPoints.map((point, idx) => (
                    <div key={idx} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-slate-200 leading-relaxed pt-0.5">{point}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-slate-800 flex items-center justify-between gap-4">
              <Button
                onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                disabled={currentSlide === 0}
                variant="outline"
                className="border-slate-700 text-white hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous (←)
              </Button>

              <div className="flex items-center gap-1.5">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentSlide ? 'w-8 bg-violet-500' : 'w-2 bg-slate-800 hover:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={() => setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))}
                disabled={currentSlide === slides.length - 1}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                Next (→)
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
