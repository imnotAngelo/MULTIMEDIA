import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Link as LinkIcon,
  Save,
  Upload,
  Video,
  X,
  Sparkles,
  FlaskConical,
  Download,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ExternalLink,
  Presentation,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { API_BASE_URL, resolveBackendAssetUrl } from '@/lib/apiConfig';
import { DocumentViewer } from '@/components/DocumentViewer';
import { PDFViewer } from '@/components/PDFViewer';
import { downloadLessonAsPDF } from '@/lib/downloadUtils';
import { useThemeStore } from '@/stores/themeStore';
import { toast } from 'sonner';

interface ViewLessonProps {
  unitId?: string;
  lessonId?: string;
  embedded?: boolean;
}

interface Lesson {
  id: string;
  unitId: string;
  title: string;
  content: string;
  createdAt: string;
  slideCount?: number;
  slides?: any[];
  videoUrl?: string;
  graphicUrl?: string;
  pdfUrl?: string;
  originalFormat?: string;
  appLink?: string;
  appName?: string;
}

export function ViewLesson({ unitId: providedUnitId, lessonId: providedLessonId, embedded = false }: ViewLessonProps = {}) {
  const routeParams = useParams();
  const unitId = providedUnitId || routeParams.unitId;
  const lessonId = providedLessonId || routeParams.lessonId;
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'next' | 'previous'>('next');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI Enhancements
  const [theaterMode, setTheaterMode] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'slides' | 'video' | 'app'>('slides');
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Media Editing
  const [editingMedia, setEditingMedia] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [mediaVideoUrl, setMediaVideoUrl] = useState('');
  const [mediaVideoFile, setMediaVideoFile] = useState<File | null>(null);
  const [mediaAppName, setMediaAppName] = useState('');
  const [mediaAppLink, setMediaAppLink] = useState('');

  // Styling helpers
  const pageClass = isLightMode
    ? 'min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/40 to-emerald-50/30 p-3 sm:p-5 lg:p-7'
    : 'min-h-screen bg-gradient-to-br from-[#061b24] via-[#0a2430] to-[#081c26] p-3 sm:p-5 lg:p-7';
  
  const panelClass = isLightMode
    ? 'rounded-2xl border border-slate-200/80 bg-white/95 p-5 sm:p-6 shadow-sm backdrop-blur-md'
    : 'rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-md';
  
  const headingClass = isLightMode ? 'text-slate-900' : 'text-white';
  const mutedTextClass = isLightMode ? 'text-slate-600' : 'text-slate-400';
  
  const slidePanelClass = isLightMode
    ? 'rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 min-h-[26rem] flex flex-col shadow-sm'
    : 'rounded-2xl border border-slate-800/90 bg-slate-900/90 p-6 sm:p-8 min-h-[26rem] flex flex-col shadow-2xl';

  useEffect(() => {
    if (!unitId || !lessonId) {
      setLesson(null);
      setError('');
      setLoading(false);
      return;
    }
    loadLesson();
  }, [unitId, lessonId]);

  useEffect(() => {
    if (!lesson) return;
    setMediaVideoUrl(lesson.videoUrl || '');
    setMediaAppName(lesson.appName || '');
    setMediaAppLink(lesson.appLink || '');
  }, [lesson?.id]);

  // Keyboard navigation & Shortcuts (Arrows & Theater mode)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowRight') {
        if (lesson?.slides && currentSlide < lesson.slides.length - 1) {
          setSlideDirection('next');
          setCurrentSlide((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentSlide > 0) {
          setSlideDirection('previous');
          setCurrentSlide((prev) => prev - 1);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        setTheaterMode((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (theaterMode) setTheaterMode(false);
      }
    },
    [lesson?.slides, currentSlide, theaterMode]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      if (!unitId || !lessonId) {
        setError(`Missing route parameters: unitId ${unitId}, lessonId ${lessonId}`);
        return;
      }

      const response = await authFetch(`${API_BASE_URL}/units/${unitId}/lessons`);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        const lessons = data.data;
        const found = lessons.find((l: any) => {
          const lId = l.id || l.lesson_id;
          return lId === lessonId || String(lId) === String(lessonId);
        });

        if (found) {
          const normalizedOriginalFormat = String(found.originalFormat || found.original_format || '').toLowerCase();
          const hasActualPdf = !!(found.pdfUrl || found.pdf_url) && !['pptx', 'ppt'].includes(normalizedOriginalFormat) && !/\.pptx?$/i.test(String(found.pdfUrl || found.pdf_url || ''));
          const isPdf = found.originalFormat === 'pdf' || found.original_format === 'pdf' || hasActualPdf;

          if (isPdf) {
            setLesson({
              id: found.id || uuidv4(),
              unitId: unitId || '',
              title: found.title || 'Untitled',
              content: found.content || '',
              createdAt: found.createdAt || new Date().toISOString(),
              slideCount: 0,
              slides: [],
              videoUrl: found.videoUrl || found.video_url || '',
              graphicUrl: found.graphicUrl || found.graphic_url || '',
              pdfUrl: found.pdfUrl || found.pdf_url || '',
              originalFormat: 'pdf',
              appLink: found.appLink || found.app_link || '',
              appName: found.appName || found.app_name || '',
            });
            setError('');
            setLoading(false);
            return;
          }

          if (found.slides && Array.isArray(found.slides) && found.slides.length > 0) {
            setLesson({
              id: found.id || uuidv4(),
              unitId: unitId || '',
              title: found.title || 'Untitled',
              content: found.content || '',
              createdAt: found.createdAt || new Date().toISOString(),
              slideCount: found.slideCount || found.slides?.length || 0,
              slides: found.slides,
              videoUrl: found.videoUrl || found.video_url || '',
              graphicUrl: found.graphicUrl || found.graphic_url || '',
              pdfUrl: found.pdfUrl || found.pdf_url || '',
              originalFormat: found.originalFormat || found.original_format || (found.pdfUrl || found.pdf_url ? 'pdf' : 'slides'),
              appLink: found.appLink || found.app_link || '',
              appName: found.appName || found.app_name || '',
            });
            setError('');
            setLoading(false);
            return;
          }

          await fetchLessonSlides(found);
          return;
        }
      }

      setError('Lesson not found');
    } catch (err) {
      setError('Failed to load lesson');
      console.error('loadLesson error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessonSlides = async (lessonData: any) => {
    try {
      const normalizedId = lessonData.id || lessonData.lesson_id;
      const response = await authFetch(`/lessons/${normalizedId}/slides`);

      if (response.ok) {
        const data = await response.json();
        const slidesData = data.data || data.slides || data || [];

        const lessonObj: Lesson = {
          id: normalizedId || uuidv4(),
          unitId: unitId || '',
          title: lessonData.title || 'Untitled Lesson',
          content: lessonData.content || '',
          createdAt: lessonData.created_at || new Date().toISOString(),
          slideCount: Array.isArray(slidesData) ? slidesData.length : 0,
          slides: Array.isArray(slidesData) ? slidesData : [],
          videoUrl: lessonData.videoUrl || lessonData.video_url || '',
          graphicUrl: lessonData.graphicUrl || lessonData.graphic_url || '',
          pdfUrl: lessonData.pdfUrl || lessonData.pdf_url || '',
          originalFormat: lessonData.originalFormat || lessonData.original_format || (lessonData.pdfUrl || lessonData.pdf_url ? 'pdf' : 'slides'),
          appLink: lessonData.appLink || lessonData.app_link || '',
          appName: lessonData.appName || lessonData.app_name || '',
        };

        setLesson(lessonObj);
        setError('');
      } else {
        const fallbackLesson: Lesson = {
          id: normalizedId || uuidv4(),
          unitId: unitId || '',
          title: lessonData.title || 'Untitled Lesson',
          content: lessonData.content || '',
          createdAt: lessonData.created_at || new Date().toISOString(),
          slideCount: 0,
          slides: [],
          videoUrl: lessonData.videoUrl || lessonData.video_url || '',
          graphicUrl: lessonData.graphicUrl || lessonData.graphic_url || '',
          pdfUrl: lessonData.pdfUrl || lessonData.pdf_url || '',
          originalFormat: lessonData.originalFormat || lessonData.original_format || (lessonData.pdfUrl || lessonData.pdf_url ? 'pdf' : 'slides'),
          appLink: lessonData.appLink || lessonData.app_link || '',
          appName: lessonData.appName || lessonData.app_name || '',
        };
        setLesson(fallbackLesson);
      }
    } catch (error) {
      console.error('Error fetching slides:', error);
    }
  };

  const saveMedia = async () => {
    if (!lessonId || !lesson) return;
    try {
      setSavingMedia(true);
      let videoUrl = mediaVideoUrl.trim();

      if (mediaVideoFile) {
        const formData = new FormData();
        formData.append('video', mediaVideoFile);
        const uploadResponse = await authFetch(`/units/lessons/${lessonId}/upload-video`, {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadData.success) {
          throw new Error(uploadData.error?.message || 'Failed to upload video');
        }
        videoUrl = uploadData.data.video_url;
      }

      const response = await authFetch(`/units/lessons/${lessonId}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl || null,
          app_name: mediaAppName.trim() || null,
          app_link: mediaAppLink.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to save lesson media');
      }

      setLesson({ ...lesson, videoUrl, appName: mediaAppName.trim(), appLink: mediaAppLink.trim() });
      setMediaVideoFile(null);
      setEditingMedia(false);
      toast.success('Lesson media updated successfully!');
    } catch (saveError: any) {
      toast.error(saveError?.message || 'Failed to save lesson media');
    } finally {
      setSavingMedia(false);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      setSlideDirection('previous');
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleNextSlide = () => {
    if (lesson?.slides && currentSlide < lesson.slides.length - 1) {
      setSlideDirection('next');
      setCurrentSlide(currentSlide + 1);
    }
  };

  const goToSlide = (index: number) => {
    if (index === currentSlide) return;
    setSlideDirection(index > currentSlide ? 'next' : 'previous');
    setCurrentSlide(index);
  };

  const handleDownloadPDF = async () => {
    if (!lesson) return;
    try {
      setDownloadingPdf(true);
      await downloadLessonAsPDF(lesson);
      toast.success('Lesson PDF exported successfully');
    } catch (e: any) {
      toast.error('Failed to export PDF: ' + (e?.message || 'Unknown error'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyNotes = () => {
    if (!lesson?.slides || !lesson.slides[currentSlide]) return;
    const slide = lesson.slides[currentSlide];
    const notes = [
      `# ${lesson.title} - Slide ${currentSlide + 1}: ${slide.title || ''}`,
      '',
      slide.content || '',
      slide.summary ? `\nSummary:\n${slide.summary}` : '',
      slide.keyPoints && slide.keyPoints.length > 0
        ? `\nKey Points:\n${slide.keyPoints.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(notes);
    setCopiedNotes(true);
    toast.success('Slide content copied to clipboard');
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Loading lesson workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-sm">
          <BookOpen className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-semibold text-white">Lesson not found</h2>
        <p className="max-w-sm text-sm text-slate-400">
          This lesson might have been moved or does not exist for this unit.
        </p>
        <div className="mt-2 flex gap-3">
          <Button onClick={() => navigate('/instructor/courses')} className="bg-violet-600 hover:bg-violet-700 text-white">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Course Outline
          </Button>
        </div>
      </div>
    );
  }

  const currentSlideData = lesson.slides?.[currentSlide];
  const hasSlides = lesson.slides && lesson.slides.length > 0;
  const normalizedFormat = String(lesson.originalFormat || '').trim().toLowerCase();
  const lessonFileUrl = String(lesson.pdfUrl || '').trim();
  const isPowerPointLesson = ['ppt', 'pptx'].includes(normalizedFormat) || /\.pptx?(?:[?#].*)?$/i.test(lessonFileUrl);
  const isPdfLesson = !!lessonFileUrl && !isPowerPointLesson;
  const resolvedVideoUrl = lesson.videoUrl ? resolveBackendAssetUrl(lesson.videoUrl) : '';

  // Quick Action Toolbar Component
  const actionToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={() => navigate('/instructor/quiz/create-auto', { state: { lessonId: lesson.id, lessonTitle: lesson.title } })}
        size="sm"
        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20 gap-1.5"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Generate AI Quiz</span>
      </Button>

      <Button
        onClick={() => navigate('/instructor/laboratories')}
        size="sm"
        variant="outline"
        className={isLightMode ? 'border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5' : 'border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5'}
      >
        <FlaskConical className="h-3.5 w-3.5 text-emerald-400" />
        <span>Laboratories</span>
      </Button>

      {hasSlides && (
        <Button
          onClick={handleDownloadPDF}
          disabled={downloadingPdf}
          size="sm"
          variant="outline"
          className={isLightMode ? 'border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5' : 'border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5'}
        >
          <Download className="h-3.5 w-3.5 text-cyan-400" />
          <span>{downloadingPdf ? 'Exporting...' : 'Export PDF'}</span>
        </Button>
      )}

      {hasSlides && (
        <Button
          onClick={() => setTheaterMode(!theaterMode)}
          size="sm"
          variant="outline"
          className={theaterMode
            ? 'border-violet-500 bg-violet-500/20 text-violet-300 gap-1.5'
            : isLightMode
              ? 'border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5'
              : 'border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5'
          }
          title="Press 'F' for Cinema Mode"
        >
          {theaterMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{theaterMode ? 'Exit Cinema' : 'Cinema Mode'}</span>
        </Button>
      )}

      <Button
        onClick={() => setEditingMedia((prev) => !prev)}
        size="sm"
        variant="outline"
        className={isLightMode ? 'border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5' : 'border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5'}
      >
        {editingMedia ? <X className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
        <span>{editingMedia ? 'Close' : 'Media Links'}</span>
      </Button>
    </div>
  );

  // PowerPoint View
  if (isPowerPointLesson) {
    const presentationUrl = resolveBackendAssetUrl(lesson.pdfUrl || '');
    return (
      <div className={pageClass}>
        <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">
          <div className={`${panelClass} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
            <div>
              <button
                onClick={() => navigate(-1)}
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Lessons
              </button>
              <h1 className={`text-2xl font-bold sm:text-3xl ${headingClass}`}>{lesson.title}</h1>
              <p className={`mt-1 text-xs font-medium uppercase tracking-wider ${mutedTextClass}`}>PowerPoint Presentation</p>
            </div>
            {actionToolbar}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <DocumentViewer lessonId={lesson.id} documentUrl={lesson.pdfUrl || ''} title={lesson.title} fileType="pptx" />
          </div>
        </div>
      </div>
    );
  }

  // PDF Document View
  if (isPdfLesson) {
    const pdfViewerUrl = resolveBackendAssetUrl(lesson.pdfUrl || '');
    return (
      <div className={pageClass}>
        <div className="mx-auto w-full max-w-7xl min-w-0 space-y-5">
          <div className={`${panelClass} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
            <div>
              <button
                onClick={() => navigate(-1)}
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Lessons
              </button>
              <h1 className={`text-2xl font-bold sm:text-3xl ${headingClass}`}>{lesson.title}</h1>
              <p className={`mt-1 text-xs font-medium uppercase tracking-wider ${mutedTextClass}`}>PDF Course Document</p>
            </div>
            {actionToolbar}
          </div>

          {editingMedia && (
            <div className={`${panelClass} border-violet-500/30`}>
              <h3 className="text-sm font-semibold text-violet-400 mb-3">Attach Video or Interactive Tool</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300">Video Link or MP4 URL</label>
                  <input
                    value={mediaVideoUrl}
                    onChange={(e) => setMediaVideoUrl(e.target.value)}
                    placeholder="https://example.com/video.mp4"
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-violet-500 outline-none"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
                    <Upload className="h-3.5 w-3.5" />
                    {mediaVideoFile ? mediaVideoFile.name : 'Or upload video file'}
                    <input type="file" accept="video/*" onChange={(e) => setMediaVideoFile(e.target.files?.[0] || null)} className="sr-only" />
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300">Interactive Tool (Canva, Figma, etc.)</label>
                  <input
                    value={mediaAppName}
                    onChange={(e) => setMediaAppName(e.target.value)}
                    placeholder="Tool name (e.g., Canva, Figma)"
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-violet-500 outline-none"
                  />
                  <input
                    value={mediaAppLink}
                    onChange={(e) => setMediaAppLink(e.target.value)}
                    placeholder="https://canva.com/..."
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-violet-500 outline-none"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={saveMedia} disabled={savingMedia} className="bg-violet-600 hover:bg-violet-700 text-white">
                  <Save className="mr-2 h-4 w-4" />
                  {savingMedia ? 'Saving...' : 'Save Media Details'}
                </Button>
              </div>
            </div>
          )}

          <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 shadow-2xl">
            <PDFViewer url={pdfViewerUrl} title={lesson.title} />
          </div>
        </div>
      </div>
    );
  }

  // Interactive Slides View (with Theater Mode and Unified Media Tabs)
  return (
    <div className={pageClass}>
      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">
        {/* Top Header Card */}
        <div className={`${panelClass} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Lessons
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className={`text-2xl font-bold sm:text-3xl ${headingClass}`}>{lesson.title}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isLightMode ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/10 text-violet-300 border border-violet-500/20'}`}>
                {lesson.slides?.length || 0} slides
              </span>
            </div>
            <p className={`mt-1 text-xs ${mutedTextClass}`}>
              Created on {new Date(lesson.createdAt).toLocaleDateString()} • Press <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-300 border border-slate-700">←</kbd> <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-300 border border-slate-700">→</kbd> to navigate, <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-300 border border-slate-700">F</kbd> for Cinema
            </p>
          </div>

          {actionToolbar}
        </div>

        {/* Media Drawer (when instructor clicks Edit Media) */}
        {editingMedia && (
          <div className={`${panelClass} border-violet-500/30`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-violet-400">Configure Lesson Media &amp; External Tools</h3>
              <Button size="sm" variant="ghost" onClick={() => setEditingMedia(false)} className="h-7 w-7 p-0 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Video URL or MP4</label>
                <input
                  value={mediaVideoUrl}
                  onChange={(e) => setMediaVideoUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-violet-500 outline-none"
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
                  <Upload className="h-3.5 w-3.5" />
                  {mediaVideoFile ? mediaVideoFile.name : 'Or upload video file'}
                  <input type="file" accept="video/*" onChange={(e) => setMediaVideoFile(e.target.files?.[0] || null)} className="sr-only" />
                </label>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Interactive Tool Integration</label>
                <input
                  value={mediaAppName}
                  onChange={(e) => setMediaAppName(e.target.value)}
                  placeholder="App name (e.g. Canva, Figma, Desmos)"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-violet-500 outline-none"
                />
                <input
                  value={mediaAppLink}
                  onChange={(e) => setMediaAppLink(e.target.value)}
                  placeholder="App share link (https://...)"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-violet-500 outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveMedia} disabled={savingMedia} className="bg-violet-600 hover:bg-violet-700 text-white">
                <Save className="mr-2 h-4 w-4" />
                {savingMedia ? 'Saving...' : 'Save Media'}
              </Button>
            </div>
          </div>
        )}

        {/* Media Switcher Tab Navigation */}
        {(lesson.videoUrl || lesson.appLink) && (
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveMediaTab('slides')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                activeMediaTab === 'slides'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Presentation className="h-4 w-4" />
              <span>Slides &amp; Concepts</span>
            </button>

            {lesson.videoUrl && (
              <button
                onClick={() => setActiveMediaTab('video')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  activeMediaTab === 'video'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Video className="h-4 w-4" />
                <span>Class Video</span>
              </button>
            )}

            {lesson.appLink && (
              <button
                onClick={() => setActiveMediaTab('app')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  activeMediaTab === 'app'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <LinkIcon className="h-4 w-4" />
                <span>{lesson.appName || 'Interactive Tool'}</span>
              </button>
            )}
          </div>
        )}

        {/* Video Tab Content */}
        {activeMediaTab === 'video' && resolvedVideoUrl && (
          <div className={`${panelClass} flex flex-col items-center justify-center p-4`}>
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-2xl">
              <video src={resolvedVideoUrl} controls className="max-h-[600px] w-full object-contain" />
            </div>
            <div className="mt-4 flex w-full max-w-4xl items-center justify-between text-xs text-slate-400">
              <span>Attached class recording for {lesson.title}</span>
              <a href={resolvedVideoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-violet-400 hover:underline">
                <ExternalLink className="h-3.5 w-3.5" />
                Open video in new tab
              </a>
            </div>
          </div>
        )}

        {/* Interactive App Tab Content */}
        {activeMediaTab === 'app' && lesson.appLink && (
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-base font-semibold ${headingClass}`}>{lesson.appName || 'Interactive Learning Tool'}</h3>
                <p className={`text-xs ${mutedTextClass}`}>Hands-on sandbox linked for this lesson</p>
              </div>
              <a
                href={lesson.appLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 shadow-md shadow-emerald-500/20 transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Full Window
              </a>
            </div>
            <div className="h-[550px] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <iframe
                src={lesson.appLink}
                title={lesson.appName || 'External Tool'}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* Slides Tab Content */}
        {activeMediaTab === 'slides' && (
          <div>
            {!hasSlides ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
                <p className="text-base font-medium text-slate-300">No slides are available for this lesson yet.</p>
                <p className="mt-2 text-sm text-slate-400">You can upload a presentation or add media using the toolbar above.</p>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                {/* Slide Outline Drawer */}
                <aside className="min-w-0">
                  <div className={`sticky top-6 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 shadow-sm backdrop-blur-md`}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">Slide Outline</h3>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {currentSlide + 1} / {lesson.slides?.length || 0}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                      {lesson.slides?.map((slide, idx) => (
                        <button
                          key={idx}
                          onClick={() => goToSlide(idx)}
                          className={`w-full text-left p-2.5 rounded-xl transition-all border ${
                            idx === currentSlide
                              ? 'border-violet-500/80 bg-gradient-to-r from-violet-600/30 to-indigo-600/20 text-white font-medium shadow-sm'
                              : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                              idx === currentSlide ? 'bg-violet-500 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="text-xs truncate">{slide.title || `Slide ${idx + 1}`}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>

                {/* Main Slide Presentation Stage */}
                <main className="min-w-0 space-y-4">
                  <div className={slidePanelClass}>
                    <div key={currentSlide} className="flex-1 flex flex-col justify-between">
                      <div>
                        {/* Slide Top Metadata */}
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-violet-500/20 px-2.5 py-1 text-xs font-bold text-violet-300">
                              Slide {currentSlide + 1}
                            </span>
                            <span className="text-xs text-slate-400">
                              of {lesson.slides?.length || 0}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              onClick={handleCopyNotes}
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                              title="Copy this slide's notes to clipboard"
                            >
                              {copiedNotes ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              <span>{copiedNotes ? 'Copied!' : 'Copy Slide'}</span>
                            </Button>

                            <Button
                              onClick={() => setTheaterMode(true)}
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                              title="Enter full distraction-free cinema mode"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                              <span>Cinema</span>
                            </Button>
                          </div>
                        </div>

                        {/* Slide Title */}
                        <h2 className={`text-2xl sm:text-3xl font-bold ${headingClass} mb-5 tracking-tight`}>
                          {currentSlideData?.title}
                        </h2>

                        {/* Slide Core Content */}
                        <div className="prose prose-invert max-w-none mb-6">
                          <p className={`text-base sm:text-lg leading-relaxed ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                            {currentSlideData?.content}
                          </p>
                        </div>

                        {/* Summary Box */}
                        {currentSlideData?.summary && (
                          <div className="mb-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-400 mb-1">
                              <FileText className="h-3.5 w-3.5" />
                              <span>Summary</span>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-300">
                              {currentSlideData.summary}
                            </p>
                          </div>
                        )}

                        {/* Concept Cards for Key Points */}
                        {currentSlideData?.keyPoints && currentSlideData.keyPoints.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Key Takeaways &amp; Concepts
                            </h4>
                            <div className="grid gap-2.5 sm:grid-cols-2">
                              {currentSlideData.keyPoints.map((point: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 transition-all hover:border-slate-700"
                                >
                                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-xs font-bold text-violet-400">
                                    {idx + 1}
                                  </span>
                                  <p className="text-xs sm:text-sm leading-snug text-slate-200 pt-0.5">
                                    {point}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Navigation & Progress Controls */}
                  <div className="flex items-center justify-between gap-4">
                    <Button
                      onClick={handlePrevSlide}
                      disabled={currentSlide === 0}
                      variant="outline"
                      className="gap-2 border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Previous</span>
                    </Button>

                    {/* Dot indicators */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[280px]">
                      {lesson.slides?.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => goToSlide(idx)}
                          className={`h-2 rounded-full transition-all ${
                            idx === currentSlide
                              ? 'w-6 bg-violet-500'
                              : 'w-2 bg-slate-700 hover:bg-slate-600'
                          }`}
                          title={`Slide ${idx + 1}`}
                        />
                      ))}
                    </div>

                    <Button
                      onClick={handleNextSlide}
                      disabled={currentSlide === (lesson.slides?.length || 0) - 1}
                      className="gap-2 bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-30"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 transition-all duration-300"
                      style={{
                        width: `${((currentSlide + 1) / (lesson.slides?.length || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </main>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Theater / Cinema Mode Overlay */}
      {theaterMode && hasSlides && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#060b13] p-4 sm:p-8 animate-in fade-in duration-200">
          {/* Cinema Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-violet-600/30 px-3 py-1 text-xs font-bold text-violet-300 border border-violet-500/40">
                Cinema Mode
              </span>
              <h3 className="text-base font-semibold text-white truncate max-w-md">{lesson.title}</h3>
              <span className="text-xs text-slate-400">
                Slide {currentSlide + 1} / {lesson.slides?.length || 0}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleCopyNotes}
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
                className="bg-slate-800 hover:bg-slate-700 text-white gap-1.5"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit Cinema (Esc)</span>
              </Button>
            </div>
          </div>

          {/* Cinema Body Stage */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto max-w-4xl mx-auto w-full py-4 space-y-6">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
                  Concept {currentSlide + 1}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {currentSlideData?.title}
              </h1>

              <p className="text-lg sm:text-xl leading-relaxed text-slate-200">
                {currentSlideData?.content}
              </p>

              {currentSlideData?.summary && (
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-300 block mb-1">
                    Summary
                  </span>
                  <p className="text-base text-slate-200 leading-relaxed">
                    {currentSlideData.summary}
                  </p>
                </div>
              )}

              {currentSlideData?.keyPoints && currentSlideData.keyPoints.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  {currentSlideData.keyPoints.map((point: string, idx: number) => (
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

            {/* Cinema Bottom Navigation */}
            <div className="pt-8 border-t border-slate-800/80 flex items-center justify-between gap-4">
              <Button
                onClick={handlePrevSlide}
                disabled={currentSlide === 0}
                variant="outline"
                className="border-slate-700 text-white hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous (←)
              </Button>

              <div className="flex items-center gap-1.5">
                {lesson.slides?.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToSlide(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentSlide ? 'w-8 bg-violet-500' : 'w-2 bg-slate-800 hover:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={handleNextSlide}
                disabled={currentSlide === (lesson.slides?.length || 0) - 1}
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
