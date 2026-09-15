import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { API_BASE_URL, resolveBackendAssetUrl } from '@/lib/apiConfig';
import { downloadLessonAsPDF } from '@/lib/downloadUtils';
import { DocumentViewer } from '@/components/DocumentViewer';
import { PDFViewer } from '@/components/PDFViewer';

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
}

export function ViewLesson() {
  const { unitId, lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLesson();
  }, [unitId, lessonId]);

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
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <p className="text-slate-600 dark:text-slate-400">Loading lesson...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-100 via-white to-slate-200 px-6 text-center dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <p className="text-red-600 dark:text-red-400">{error || 'Lesson not found'}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">Route params - unitId: {unitId}, lessonId: {lessonId}</p>
        <Button onClick={() => navigate(-1)} className="bg-violet-600 hover:bg-violet-700 text-white">
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
          <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <button
                    onClick={() => navigate(-1)}
                    className="mb-4 flex items-center gap-2 text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Lessons
                  </button>
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{lesson.title}</h1>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">Converted PowerPoint lesson</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
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

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30 dark:border-slate-800 dark:bg-slate-950 dark:shadow-cyan-500/10">
                <DocumentViewer lessonId={lesson.id} documentUrl={lesson.pdfUrl || ''} title={lesson.title} fileType="pptx" />
              </div>
            </div>
          </div>
        );
      }

      if (isPdfLesson) {
        const pdfViewerUrl = resolveBackendAssetUrl(lesson.pdfUrl || '');
        console.log('📄 PDF Lesson Rendering:', {
          originalPdfUrl: lesson.pdfUrl,
          resolvedPdfUrl: pdfViewerUrl,
          isValidUrl: !!pdfViewerUrl && pdfViewerUrl.trim() !== '',
        });
        
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <button
                    onClick={() => navigate(-1)}
                    className="mb-4 flex items-center gap-2 text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Lessons
                  </button>
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{lesson.title}</h1>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">PDF Document</p>
                </div>
              </div>  

              <PDFViewer url={pdfViewerUrl} title={lesson.title} onDownload={handleDownloadPDF} />
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-2 text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Lessons
            </button>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{lesson.title}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
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
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <h3 className="mb-3 text-sm font-semibold text-violet-600 dark:text-violet-300">Class video</h3>
                <video src={lesson.videoUrl} controls className="w-full rounded-xl max-h-72 object-cover" />
              </div>
            )}

            {lesson.graphicUrl && (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <h3 className="mb-3 text-sm font-semibold text-violet-600 dark:text-violet-300">Class graphic</h3>
                <img src={lesson.graphicUrl} alt={`${lesson.title} graphic`} className="w-full rounded-xl max-h-72 object-cover border border-slate-200 dark:border-slate-700" />
              </div>
            )}
          </div>
        )}

        {!hasSlides ? (
          <div className="rounded-xl border border-slate-200 bg-white/80 p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <p className="mb-4 text-slate-600 dark:text-slate-400">No slides available for this lesson</p>
            <p className="mt-2 text-xs text-amber-600 dark:text-yellow-400">Try clicking View again or check browser console for details</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Slide Navigation Sidebar */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="sticky top-6 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Slides</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {lesson.slides?.map((slide, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToSlide(idx)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        idx === currentSlide
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
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
            <div className="lg:col-span-3 order-1 lg:order-2">
              {/* Slide Content */}
              <div className="mb-6 flex min-h-96 flex-col rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-100/80 p-8 shadow-sm dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-800/50">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-violet-400 mb-3">
                    Slide {currentSlide + 1} of {lesson.slides?.length || 0}
                  </div>
                  <h2 className="mb-6 text-4xl font-bold text-slate-900 dark:text-white">{currentSlideData?.title}</h2>
                  <div className="prose max-w-none mb-6 dark:prose-invert">
                    <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300">{currentSlideData?.content}</p>
                  </div>

                  {currentSlideData?.summary && (
                    <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                      <h4 className="mb-2 text-sm font-semibold text-violet-500 dark:text-violet-400">Summary</h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{currentSlideData.summary}</p>
                    </div>
                  )}

                  {currentSlideData?.keyPoints && currentSlideData.keyPoints.length > 0 && (
                    <div className="rounded-lg bg-slate-100/80 p-6 dark:bg-slate-900/30">
                      <h4 className="mb-4 text-sm font-semibold text-violet-500 dark:text-violet-400">Key Points</h4>
                      <ul className="space-y-3">
                        {currentSlideData.keyPoints.map((point: string, idx: number) => (
                          <li key={idx} className="flex gap-3 text-slate-700 dark:text-slate-300">
                            <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-violet-600/30 bg-violet-600/10 text-xs text-violet-600 dark:border-violet-600/40 dark:bg-violet-600/20 dark:text-violet-400">
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
                  className="gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
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
                          : 'h-2 w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500'
                      } rounded-full`}
                      title={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <Button
                  onClick={handleNextSlide}
                  disabled={currentSlide === (lesson.slides?.length || 0) - 1}
                  className="gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="mt-6 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
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
