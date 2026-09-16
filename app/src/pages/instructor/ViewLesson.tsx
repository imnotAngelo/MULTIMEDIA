import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Edit2, Link as LinkIcon, Save, Upload, Video, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { API_BASE_URL, resolveBackendAssetUrl } from '@/lib/apiConfig';
import { downloadLessonAsPDF } from '@/lib/downloadUtils';
import { DocumentViewer } from '@/components/DocumentViewer';
import { PDFViewer } from '@/components/PDFViewer';
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
  const pageClass = isLightMode
    ? 'min-h-screen bg-gradient-to-br from-cyan-50 via-white to-teal-50 p-6'
    : 'min-h-screen bg-gradient-to-br from-[#061b24] via-[#092f3b] to-[#06151d] p-6';
  const panelClass = 'glass-panel rounded-2xl p-6';
  const mediaPanelClass = 'glass-panel rounded-2xl p-4';
  const headingClass = isLightMode ? 'text-slate-900' : 'text-white';
  const mutedTextClass = isLightMode ? 'text-slate-600' : 'text-slate-400';
  const softPanelClass = 'glass-panel rounded-xl p-12 text-center';
  const slidePanelClass = 'glass-panel rounded-2xl p-8 mb-6 min-h-96 flex flex-col';
  const nestedPanelClass = 'glass-panel rounded-lg p-4 mb-6';
  const navigationPanelClass = 'glass-panel rounded-xl p-4 sticky top-6';
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingMedia, setEditingMedia] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [mediaVideoUrl, setMediaVideoUrl] = useState('');
  const [mediaVideoFile, setMediaVideoFile] = useState<File | null>(null);
  const [mediaAppName, setMediaAppName] = useState('');
  const [mediaAppLink, setMediaAppLink] = useState('');

  useEffect(() => {
    loadLesson();
  }, [unitId, lessonId]);

  useEffect(() => {
    if (!lesson) return;
    setMediaVideoUrl(lesson.videoUrl || '');
    setMediaAppName(lesson.appName || '');
    setMediaAppLink(lesson.appLink || '');
  }, [lesson?.id]);

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
      toast.success('Lesson media updated');
    } catch (saveError: any) {
      toast.error(saveError?.message || 'Failed to save lesson media');
    } finally {
      setSavingMedia(false);
    }
  };

  const loadLesson = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Route params:', { unitId, lessonId });
      console.warn('🚨 DEBUG: unitId type:', typeof unitId, 'value:', unitId);
      console.warn('🚨 DEBUG: lessonId type:', typeof lessonId, 'value:', lessonId);

      if (!unitId || !lessonId) {
        setError(`❌ Missing route parameters - unitId: ${unitId}, lessonId: ${lessonId}`);
        return;
      }

      console.log('📡 Fetching from API:', `/api/units/${unitId}/lessons`);
      try {
        const response = await authFetch(`${API_BASE_URL}/units/${unitId}/lessons`);

        console.log('📊 API Response status:', response.status);
        const data = await response.json();
        console.log('📖 API lessons response:', data);

        if (data.success && Array.isArray(data.data)) {
          const lessons = data.data;
          console.log('🔎 Searching for lessonId:', lessonId, 'in lessons:', lessons);
          
          const found = lessons.find((l: any) => {
            const lId = l.id || l.lesson_id;
            console.log('Comparing:', lId, '===', lessonId, '?', lId === lessonId || String(lId) === String(lessonId));
            return lId === lessonId || String(lId) === String(lessonId);
          });
          
          if (found) {
            console.log('✅ Found lesson in API:', found);
            console.log('📊 Lesson data:', { 
              slides: found.slides, 
              slideCount: found.slideCount, 
              pdfUrl: found.pdfUrl || found.pdf_url,
              originalFormat: found.originalFormat || found.original_format
            });
            
            const normalizedOriginalFormat = String(found.originalFormat || found.original_format || '').toLowerCase();
            const hasActualPdf = !!(found.pdfUrl || found.pdf_url) && !['pptx', 'ppt'].includes(normalizedOriginalFormat) && !/\.pptx?$/i.test(String(found.pdfUrl || found.pdf_url || ''));
            const isPdf = found.originalFormat === 'pdf' || found.original_format === 'pdf' || hasActualPdf;

            if (isPdf) {
              console.log('✅ PDF lesson detected - skipping slide fetch');
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
            
            // Check if lesson already has slides embedded
            if (found.slides && Array.isArray(found.slides) && found.slides.length > 0) {
              console.log('✅ Lesson has embedded slides:', found.slides.length, 'slides');
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
            } else {
              console.warn('⚠️ Lesson has no embedded slides, fetching separately...');
            }
            
            // Otherwise fetch slides separately
            await fetchLessonSlides(found);
            return;
          } else {
            console.warn('⚠️ Lesson ID not found in API response');
            console.log('Available lesson IDs:', lessons.map((l: any) => l.id || l.lesson_id));
          }
        }
      } catch (apiError) {
        console.error('❌ API fetch error:', apiError);
      }

      setError('❌ Lesson not found - check browser console for details');
    } catch (err) {
      setError('Failed to load lesson');
      console.error('❌ loadLesson error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessonSlides = async (lessonData: any) => {
    try {
      // Normalize lesson ID - might be 'id' or 'lesson_id'
      const normalizedId = lessonData.id || lessonData.lesson_id;
      
      console.log('📊 Fetching slides for lesson:', {
        lessonId: normalizedId,
        originalLessonData: lessonData,
      });

      const response = await authFetch(`/lessons/${normalizedId}/slides`);

      console.log('📊 Slides response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Slides response:', data);

        // Handle both nested and flat response formats
        const slidesData = data.data || data.slides || data || [];
        
        console.log('✅ Processed slides:', {
          slidesData,
          count: Array.isArray(slidesData) ? slidesData.length : 0,
        });

        const lesson: Lesson = {
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

        console.log('✅ Final lesson object:', lesson);
        setLesson(lesson);
        setError('');
      } else {
        console.error('❌ Failed to fetch slides, status:', response.status);
        
        // Still set the lesson even if slides failed
        const lesson: Lesson = {
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
        setLesson(lesson);
        setError('⚠️ Could not load slides');
      }
    } catch (error) {
      console.error('❌ Error fetching slides:', error);
      
      // Fallback: set lesson without slides
      const fallbackLesson: Lesson = {
        id: (lessonData.id || lessonData.lesson_id) || uuidv4(),
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
      setError('Failed to load lesson slides, but showing lesson info');
    }
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleNextSlide = () => {
    if (lesson?.slides && currentSlide < lesson.slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const handleDownloadPDF = async () => {
    if (lesson) {
      await downloadLessonAsPDF(lesson);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-400">Loading lesson...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <p className="text-red-400">{error || 'Lesson not found'}</p>
            <p className="text-slate-400 text-sm">Route params - unitId: {unitId}, lessonId: {lessonId}</p>
            <Button onClick={() => navigate(-1)} className="bg-violet-600 hover:bg-violet-700">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        );
      }

      const currentSlideData = lesson.slides?.[currentSlide];
      const hasSlides = lesson.slides && lesson.slides.length > 0;
      const normalizedFormat = String(lesson.originalFormat || '').trim().toLowerCase();
      const lessonFileUrl = String(lesson.pdfUrl || '').trim();
      const isPowerPointLesson = ['ppt', 'pptx'].includes(normalizedFormat) || /\.pptx?(?:[?#].*)?$/i.test(lessonFileUrl);
      const isPdfLesson = !!lessonFileUrl && !isPowerPointLesson;

      console.log('🎬 Rendering ViewLesson:', {
        lessonTitle: lesson.title,
        totalSlides: lesson.slides?.length || 0,
        currentSlide,
        hasSlides,
        currentSlideData,
        isPdfLesson,
        pdfUrl: lesson.pdfUrl,
        originalFormat: lesson.originalFormat,
      });

      if (isPowerPointLesson) {
        const presentationUrl = resolveBackendAssetUrl(lesson.pdfUrl || '');

        return (
          <div className={pageClass}>
            <div className="w-full max-w-6xl min-w-0 mx-auto space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-violet-400 hover:text-violet-300 mb-4 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Lessons
                  </button>
                  <h1 className={`responsive-page-title font-bold ${headingClass}`}>{lesson.title}</h1>
                  <p className={`${mutedTextClass} mt-2`}>Converted PowerPoint lesson</p>
                </div>
              </div>

              <div className={panelClass}>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => window.open(presentationUrl, '_blank', 'noopener,noreferrer')}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    Open presentation
                  </Button>
                  <Button
                    onClick={handleDownloadPDF}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PPTX
                  </Button>
                </div>
              </div>

              <div className={`overflow-hidden rounded-2xl border ${isLightMode ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-800 bg-slate-950 shadow-2xl shadow-cyan-500/10'}`}>
                <DocumentViewer lessonId={lesson.id} documentUrl={lesson.pdfUrl || ''} title={lesson.title} fileType="pptx" />
              </div>
            </div>
          </div>
        );
      }

      if (isPdfLesson) {
        const pdfViewerUrl = resolveBackendAssetUrl(lesson.pdfUrl || '');
        const lessonVideoUrl = resolveBackendAssetUrl(lesson.videoUrl || '');
        console.log('📄 PDF Lesson Rendering:', {
          originalPdfUrl: lesson.pdfUrl,
          resolvedPdfUrl: pdfViewerUrl,
          isValidUrl: !!pdfViewerUrl && pdfViewerUrl.trim() !== '',
        });
        
        return (
          <div className={`${pageClass} !p-2 sm:!p-3`}>
            <div className="w-full min-w-0">
              <PDFViewer url={pdfViewerUrl} title={lesson.title} onDownload={handleDownloadPDF} />

              <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Lesson media</h2>
                    <p className="mt-1 text-xs text-slate-500">Optional video and class tool resources</p>
                  </div>
                  <Button
                    onClick={() => setEditingMedia((current) => !current)}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    {editingMedia ? <X className="mr-2 h-4 w-4" /> : <Edit2 className="mr-2 h-4 w-4" />}
                    {editingMedia ? 'Close editor' : 'Edit media'}
                  </Button>
                </div>

                {lessonVideoUrl && !editingMedia && (
                  <video src={lessonVideoUrl} controls className="mt-4 max-h-[360px] w-full rounded-lg bg-black object-contain" />
                )}

                {lesson.appLink && !editingMedia && (
                  <a href={lesson.appLink} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200">
                    <LinkIcon className="h-4 w-4" />
                    {lesson.appName || 'Open class tool'}
                  </a>
                )}

                {editingMedia && (
                  <div className="mt-4 grid gap-4 border-t border-slate-800 pt-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="lesson-video-url" className="text-xs font-medium text-slate-300">Video URL</label>
                      <input id="lesson-video-url" value={mediaVideoUrl} onChange={(event) => setMediaVideoUrl(event.target.value)} placeholder="https://example.com/video.mp4" className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-violet-400" />
                      <label htmlFor="lesson-video-file" className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
                        <Upload className="h-4 w-4" />
                        {mediaVideoFile ? mediaVideoFile.name : 'Upload a video file'}
                      </label>
                      <input id="lesson-video-file" type="file" accept="video/*" onChange={(event) => setMediaVideoFile(event.target.files?.[0] || null)} className="sr-only" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="lesson-app-name" className="text-xs font-medium text-slate-300">App or tool</label>
                      <input id="lesson-app-name" value={mediaAppName} onChange={(event) => setMediaAppName(event.target.value)} placeholder="Canva, Figma, Photoshop" className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-violet-400" />
                      <input id="lesson-app-link" value={mediaAppLink} onChange={(event) => setMediaAppLink(event.target.value)} placeholder="https://app.example.com" className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-violet-400" />
                    </div>
                    <div className="flex justify-end md:col-span-2">
                      <Button onClick={saveMedia} disabled={savingMedia} className="bg-violet-600 hover:bg-violet-700">
                        <Save className="mr-2 h-4 w-4" />
                        {savingMedia ? 'Saving...' : 'Save media'}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        );
      }

      return (
        <div className={pageClass}>
          <div className="w-full max-w-7xl min-w-0 mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-violet-400 hover:text-violet-300 mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Lessons
            </button>
            <h1 className={`responsive-page-title font-bold ${headingClass}`}>{lesson.title}</h1>
            <p className={`${mutedTextClass} mt-2`}>
              Created{' '}
              {new Date(lesson.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            onClick={handleDownloadPDF}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Download className="w-4 h-4" />
            Download as PDF
          </Button>
        </div>

        {(lesson.videoUrl || lesson.graphicUrl) && (
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {lesson.videoUrl && (
              <div className={mediaPanelClass}>
                <h3 className="text-sm font-semibold text-violet-300 mb-3">Class video</h3>
                <video src={lesson.videoUrl} controls className="w-full rounded-xl max-h-72 object-cover" />
              </div>
            )}

            {lesson.graphicUrl && (
              <div className={mediaPanelClass}>
                <h3 className="text-sm font-semibold text-violet-300 mb-3">Class graphic</h3>
                <img src={lesson.graphicUrl} alt={`${lesson.title} graphic`} className="w-full rounded-xl max-h-72 object-cover border border-slate-700" />
              </div>
            )}
          </div>
        )}

        {!hasSlides ? (
          <div className={softPanelClass}>
            <p className="text-slate-400 mb-4">No slides available for this lesson</p>
            <p className="text-yellow-400 text-xs mt-2">Try clicking View again or check browser console for details</p>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Slide Navigation Sidebar */}
            <div className="min-w-0 lg:col-span-1 order-2 lg:order-1">
              <div className={navigationPanelClass}>
                <h3 className={`text-sm font-semibold ${isLightMode ? 'text-slate-800' : 'text-slate-200'} mb-4`}>Slides</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {lesson.slides?.map((slide, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToSlide(idx)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        idx === currentSlide
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : isLightMode
                            ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      } border`}
                    >
                      <div className="text-xs font-medium opacity-75">Slide {idx + 1}</div>
                      <div className="text-sm font-semibold mt-1 line-clamp-2">{slide.title}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="min-w-0 lg:col-span-3 order-1 lg:order-2">
              {/* Slide Content */}
              <div className={slidePanelClass}>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-violet-400 mb-3">
                    Slide {currentSlide + 1} of {lesson.slides?.length || 0}
                  </div>
                  <h2 className={`responsive-slide-title font-bold ${headingClass} mb-6`}>{currentSlideData?.title}</h2>
                  <div className="max-w-none mb-6">
                    <p className={`responsive-reading ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>{currentSlideData?.content}</p>
                  </div>

                  {currentSlideData?.summary && (
                    <div className={nestedPanelClass}>
                      <h4 className="text-sm font-semibold text-violet-400 mb-2">Summary</h4>
                      <p className={`${isLightMode ? 'text-slate-700' : 'text-slate-300'} text-sm`}>{currentSlideData.summary}</p>
                    </div>
                  )}

                  {currentSlideData?.keyPoints && currentSlideData.keyPoints.length > 0 && (
                    <div className={`${isLightMode ? 'bg-slate-50 border border-slate-200' : 'bg-slate-900/30'} rounded-lg p-6`}>
                      <h4 className="text-sm font-semibold text-violet-400 mb-4">Key Points</h4>
                      <ul className="space-y-3">
                        {currentSlideData.keyPoints.map((point: string, idx: number) => (
                          <li key={idx} className={`flex gap-3 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-violet-600/20 border border-violet-600/40 rounded-full text-violet-400 text-xs flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="pt-0.5">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between gap-4">
                <Button
                  onClick={handlePrevSlide}
                  disabled={currentSlide === 0}
                  className={isLightMode
                    ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 gap-2'
                    : 'bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-700 text-white gap-2'}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                {/* Slide Indicators */}
                <div className="flex gap-2 flex-wrap justify-center">
                  {lesson.slides?.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToSlide(idx)}
                      className={`transition-all ${
                        idx === currentSlide
                          ? 'w-8 h-2 bg-violet-500'
                          : `w-2 h-2 ${isLightMode ? 'bg-slate-300 hover:bg-slate-400' : 'bg-slate-600 hover:bg-slate-500'}`
                      } rounded-full`}
                      title={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <Button
                  onClick={handleNextSlide}
                  disabled={currentSlide === (lesson.slides?.length || 0) - 1}
                  className={isLightMode
                    ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 gap-2'
                    : 'bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-700 text-white gap-2'}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Progress Bar */}
              <div className={`mt-6 ${isLightMode ? 'bg-slate-200' : 'bg-slate-900'} rounded-full h-1 overflow-hidden`}>
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-violet-500 transition-all duration-300"
                  style={{
                    width: `${((currentSlide + 1) / (lesson.slides?.length || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
        </div>
        </div>
      );
    }
