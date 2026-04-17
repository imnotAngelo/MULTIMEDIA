import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeft, ChevronRight, MessageCircle, ThumbsUp, Lock, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { authFetch } from '@/lib/authFetch';
import { downloadLessonAsPDF } from '@/lib/downloadUtils';

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

export function SlideViewer({ lessonId, lessonTitle }: SlideViewerProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [lesson, setLesson] = useState<any>(null);

  useEffect(() => {
    loadSlides();
    loadComments();
  }, [lessonId]);

  const loadSlides = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔍 Loading slides for lesson:', lessonId);

      // Try to fetch all units to find the lesson
      const unitsResponse = await authFetch('http://localhost:3001/api/units');

      const unitsData = await unitsResponse.json();
      console.log('📚 Units fetched:', unitsData.data?.length || 0);

      if (!unitsData.success) {
        throw new Error('Failed to fetch units');
      }

      const units = unitsData.data || [];
      let foundSlides: Slide[] = [];
      let foundLesson: any = null;

      // Search through all units for this lesson
      for (const unit of units) {
        const lessonsResponse = await authFetch(`http://localhost:3001/api/units/${unit.id}/lessons`);

        const lessonsData = await lessonsResponse.json();
        console.log(`📖 Lessons for unit ${unit.id}:`, lessonsData.data?.length || 0);

        if (lessonsData.success) {
          const lessons = lessonsData.data || [];
          const lesson = lessons.find((l: any) => l.id === lessonId);

          if (lesson) {
            console.log('✅ Found lesson:', lesson);
            console.log('🎬 Lesson has slides?', lesson.slides);
            console.log('📊 Slide count:', lesson.slides?.length || lesson.slideCount || 0);

            if (lesson.slides && Array.isArray(lesson.slides) && lesson.slides.length > 0) {
              foundLesson = lesson;
              foundSlides = lesson.slides.map((slide: any, idx: number) => ({
                id: slide.slideNumber || idx,
                slideNumber: slide.slideNumber || idx + 1,
                title: slide.title || 'Untitled Slide',
                content: slide.content || '',
                summary: slide.summary || '',
                keyPoints: Array.isArray(slide.keyPoints) ? slide.keyPoints : [],
              }));
              console.log('✨ Mapped slides:', foundSlides.length);
              break;
            }
          }
        }
      }

      if (foundSlides.length === 0) {
        console.warn('⚠️ No slides found in database');
        setError('No slides found for this lesson.');
      } else {
        console.log('✅ Slides loaded successfully:', foundSlides.length);
        setSlides(foundSlides);
        setLesson(foundLesson);
      }
    } catch (err: any) {
      console.error('❌ Error loading slides:', err);
      setError(err.message || 'Failed to load slides');
    } finally {
      setLoading(false);
    }
  };

  const loadSlidesFromAPI = async () => {
    try {
      const response = await authFetch(`http://localhost:3001/api/lessons/${lessonId}/slides`);

      if (!response.ok) throw new Error('Failed to load slides');

      const data = await response.json();
      setSlides(data.data || []);
    } catch (err) {
      setError('Failed to load lesson slides');
      console.error(err);
      setLoading(false);
    }
  };

  const loadComments = () => {
    try {
      // Load comments from localStorage
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
        author: 'You',
        content: newComment,
        timestamp: new Date().toLocaleString(),
        likes: 0,
        userLiked: false,
        slideNumber: currentSlide + 1,
      };

      const updatedComments = [...comments, newCommentObj];
      setComments(updatedComments);
      localStorage.setItem(`comments_${lessonId}`, JSON.stringify(updatedComments));
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
      alert('Failed to post comment');
    }
  };

  const handleLikeComment = (commentId: string) => {
    try {
      const updatedComments = comments.map(c => {
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
      await downloadLessonAsPDF(lesson);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-slate-400">Loading slides...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-12">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="text-center p-12 bg-slate-900/60 border border-slate-800 rounded-xl">
        <Lock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No slides available for this lesson yet</p>
        <p className="text-slate-500 text-sm mt-2">The instructor is still preparing this lesson</p>
      </div>
    );
  }

  const slide = slides[currentSlide];
  const slideComments = comments.filter(c => !c.slideNumber || c.slideNumber === currentSlide + 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Slide Viewer */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 p-8 min-h-screen lg:min-h-[600px] flex flex-col justify-between overflow-y-auto">
          {/* Slide Header */}
          <div className="pb-4 border-b border-slate-700">
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white mb-3">{slide.title}</h2>
                <div className="text-sm text-slate-400">
                  Slide {currentSlide + 1} of {slides.length} • {lessonTitle}
                </div>
              </div>
              <Button
                onClick={handleDownloadPDF}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 whitespace-nowrap flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          </div>

          {/* Slide Content */}
          <div className="space-y-6 flex-grow py-6">
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-200 text-lg leading-relaxed whitespace-pre-wrap">{slide.content}</p>
            </div>

            {slide.keyPoints && slide.keyPoints.length > 0 && (
              <div className="p-5 bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="text-base font-semibold text-violet-400 mb-4">Key Points</h3>
                <ul className="space-y-3">
                  {slide.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-300">
                      <span className="text-violet-400 flex-shrink-0 font-semibold">→</span>
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Summary */}
          {slide.summary && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <p className="text-sm text-emerald-100 italic font-medium">{slide.summary}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Button
            onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentSlide
                    ? 'bg-violet-500 w-8'
                    : 'bg-slate-700 w-2 hover:bg-slate-600'
                }`}
                title={`Slide ${idx + 1}`}
              />
            ))}
          </div>

          <Button
            onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
            disabled={currentSlide === slides.length - 1}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Progress */}
        <div className="text-center text-sm text-slate-400">
          Progress: {Math.round(((currentSlide + 1) / slides.length) * 100)}% completed
        </div>
      </div>

      {/* Discussion Panel */}
      <div className="lg:col-span-1">
        <Card className="bg-slate-900/60 border-slate-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Discussion
            </h3>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">
              {slideComments.length}
            </span>
          </div>

          {/* Comments List */}
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
            {slideComments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No comments yet. Be the first!</p>
            ) : (
              slideComments.map(comment => (
                <div key={comment.id} className="bg-slate-800/30 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs font-medium text-slate-300">{comment.author}</p>
                    <span className="text-xs text-slate-500">
                      {new Date(comment.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2">{comment.content}</p>
                  <button
                    onClick={() => handleLikeComment(comment.id)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400 transition-colors"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{comment.likes}</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Comment Form */}
          <form onSubmit={handlePostComment} className="space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts on this slide..."
              rows={2}
              className="bg-slate-800 border-slate-700 text-white text-xs placeholder:text-slate-500 resize-none"
            />
            <Button
              type="submit"
              disabled={!newComment.trim()}
              size="sm"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs"
            >
              Post Comment
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
