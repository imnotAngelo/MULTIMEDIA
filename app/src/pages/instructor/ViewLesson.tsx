import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { downloadLessonAsPDF } from '@/lib/downloadUtils';

interface Lesson {
  id: string;
  unitId: string;
  title: string;
  content: string;
  createdAt: string;
  slideCount?: number;
  slides?: any[];
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

      // First try localStorage (where lessons are cached after upload)
      console.log('📚 Checking localStorage for lessons_' + unitId);
      const savedLessons = localStorage.getItem(`lessons_${unitId}`);
      if (savedLessons) {
        try {
          const lessons = JSON.parse(savedLessons);
          console.log('📖 localStorage lessons:', lessons);
          
          const found = lessons.find((l: any) => l.id === lessonId || String(l.id) === String(lessonId));
          if (found) {
            console.log('✅ Found lesson in localStorage:', found);
            // Lesson from localStorage might include slides already
            setLesson({
              id: found.id || uuidv4(),
              unitId: unitId || '',
              title: found.title || 'Untitled',
              content: found.content || '',
              createdAt: found.createdAt || new Date().toISOString(),
              slideCount: found.slideCount || found.slides?.length || 0,
              slides: found.slides || [],
            });
            setError('');
            setLoading(false);
            return;
          }
        } catch (parseErr) {
          console.error('❌ Failed to parse localStorage:', parseErr);
        }
      }

      // Try to fetch from API backend
      console.log('📡 Fetching from API:', `/api/units/${unitId}/lessons`);
      try {
        const response = await authFetch(`http://localhost:3001/api/units/${unitId}/lessons`);

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
            console.log('📊 Lesson slides data:', { slides: found.slides, slideCount: found.slideCount, slidesLength: found.slides?.length });
            
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

      const response = await authFetch(`http://localhost:3001/api/lessons/${normalizedId}/slides`);

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

      console.log('🎬 Rendering ViewLesson:', { 
        lessonTitle: lesson.title, 
        totalSlides: lesson.slides?.length || 0, 
        currentSlide, 
        hasSlides,
        currentSlideData 
      });

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
          <div className="max-w-7xl mx-auto">
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
            <h1 className="text-4xl font-bold text-white">{lesson.title}</h1>
            <p className="text-slate-400 mt-2">
              {lesson.slideCount || lesson.slides?.length || 0} slides • Created{' '}
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

        {!hasSlides ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400 mb-4">No slides available for this lesson</p>
            <p className="text-slate-500 text-sm max-w-2xl mx-auto mb-4">{lesson.content}</p>
            <p className="text-yellow-400 text-xs">Slides: {lesson.slideCount || lesson.slides?.length || 0}</p>
            <p className="text-yellow-400 text-xs mt-2">Try clicking View again or check browser console for details</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Slide Navigation Sidebar */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sticky top-6">
                <h3 className="text-sm font-semibold text-slate-200 mb-4">Slides</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {lesson.slides?.map((slide, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToSlide(idx)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        idx === currentSlide
                          ? 'bg-violet-600 border-violet-500 text-white'
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
            <div className="lg:col-span-3 order-1 lg:order-2">
              {/* Slide Content */}
              <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-800 rounded-2xl p-8 mb-6 min-h-96 flex flex-col">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-violet-400 mb-3">
                    Slide {currentSlide + 1} of {lesson.slides?.length || 0}
                  </div>
                  <h2 className="text-4xl font-bold text-white mb-6">{currentSlideData?.title}</h2>
                  <div className="prose prose-invert max-w-none mb-6">
                    <p className="text-lg text-slate-300 leading-relaxed">{currentSlideData?.content}</p>
                  </div>

                  {currentSlideData?.summary && (
                    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mb-6">
                      <h4 className="text-sm font-semibold text-violet-400 mb-2">Summary</h4>
                      <p className="text-slate-300 text-sm">{currentSlideData.summary}</p>
                    </div>
                  )}

                  {currentSlideData?.keyPoints && currentSlideData.keyPoints.length > 0 && (
                    <div className="bg-slate-900/30 rounded-lg p-6">
                      <h4 className="text-sm font-semibold text-violet-400 mb-4">Key Points</h4>
                      <ul className="space-y-3">
                        {currentSlideData.keyPoints.map((point: string, idx: number) => (
                          <li key={idx} className="flex gap-3 text-slate-300">
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
                  className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-700 text-white gap-2"
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
                          : 'w-2 h-2 bg-slate-600 hover:bg-slate-500'
                      } rounded-full`}
                      title={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <Button
                  onClick={handleNextSlide}
                  disabled={currentSlide === (lesson.slides?.length || 0) - 1}
                  className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-700 text-white gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="mt-6 bg-slate-900 rounded-full h-1 overflow-hidden">
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
