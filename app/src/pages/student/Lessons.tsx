import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Play, 
  Clock, 
  FileText,
  ChevronDown,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { SlideViewer } from './SlideViewer';
import { cn } from '@/lib/utils';

interface Unit {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  createdAt: string;
}

interface Lesson {
  id: string;
  unitId: string;
  title: string;
  content: string;
  createdAt: string;
  slideCount?: number;
  slides?: any[];
}

function LessonItem({ lesson, isActive, onClick }: {
  lesson: Lesson;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left',
        isActive
          ? 'bg-violet-500/10 border border-violet-500/30'
          : 'hover:bg-slate-800/50 border border-transparent'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          isActive
            ? 'bg-violet-500/20 text-violet-400'
            : 'bg-slate-800 text-slate-500'
        )}
      >
        <FileText className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate',
            isActive ? 'text-violet-400' : 'text-slate-300'
          )}
        >
          {lesson.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{lesson.slideCount || 0} slides</span>
        </div>
      </div>
    </button>
  );
}

function UnitSection({
  unit,
  lessons,
  isExpanded,
  activeLessonId,
  onToggle,
  onLessonClick,
}: {
  unit: Unit;
  lessons: Lesson[];
  isExpanded: boolean;
  activeLessonId?: string;
  onToggle: () => void;
  onLessonClick: (lessonId: string) => void;
}) {
  const unitLessons = lessons.filter(l => l.unitId === unit.id);
  const completedCount = 0; // Can be enhanced with progress tracking

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      {/* Unit Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-4 p-4 transition-colors',
          'bg-slate-900/60 hover:bg-slate-800/50'
        )}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-500/10 text-violet-400">
          <BookOpen className="w-5 h-5" />
        </div>

        <div className="flex-1 text-left">
          <h3 className="font-semibold text-slate-200">{unit.title}</h3>
          <p className="text-sm text-slate-500">{unit.description}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-sm font-medium text-slate-400">
              {completedCount}/{unitLessons.length}
            </span>
            <p className="text-xs text-slate-500">lessons</p>
          </div>
          <ChevronDown
            className={cn(
              'w-5 h-5 text-slate-500 transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Unit Content */}
      {isExpanded && (
        <div className="border-t border-slate-800">
          {unitLessons.length === 0 ? (
            <div className="p-4 text-center text-slate-400">
              <p className="text-sm">No lessons yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {unitLessons.map(lesson => (
                <LessonItem
                  key={lesson.id}
                  lesson={lesson}
                  isActive={lesson.id === activeLessonId}
                  onClick={() => onLessonClick(lesson.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Lessons() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'viewer'>('list');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📚 Fetching units from API...');
      
      // Fetch units from API
      const unitsResponse = await authFetch('http://localhost:3001/api/units');

      const unitsData = await unitsResponse.json();
      console.log('✅ Units fetched:', unitsData.data || []);

      const unitList: Unit[] = unitsData.success ? (unitsData.data || []) : [];
      setUnits(unitList);

      // Fetch all lessons from all units
      const allLessons: Lesson[] = [];

      for (const unit of unitList) {
        const lessonsResponse = await authFetch(`http://localhost:3001/api/units/${unit.id}/lessons`);

        const lessonsData = await lessonsResponse.json();
        if (lessonsData.success) {
          const lessons = lessonsData.data || [];
          console.log(`✅ Lessons for unit "${unit.title}": ${lessons.length}`);
          allLessons.push(...lessons.map((l: any) => ({
            ...l,
            unitId: unit.id,
          })));
        }
      }

      console.log('✅ Total lessons loaded:', allLessons.length, allLessons);
      
      setLessons(allLessons);

      // Auto-expand first unit and set first lesson as active
      if (unitList.length > 0) {
        setExpandedUnits([unitList[0].id]);
        if (allLessons.length > 0) {
          setActiveLessonId(allLessons[0].id);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev =>
      prev.includes(unitId)
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const activeLesson = lessons.find(l => l.id === activeLessonId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-slate-400">Loading lessons...</p>
      </div>
    );
  }

  if (viewMode === 'viewer' && activeLesson) {
    return (
      <div className="space-y-4">
        <Button
          onClick={() => setViewMode('list')}
          variant="outline"
          className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Lessons
        </Button>
        <SlideViewer lessonId={activeLesson.id} lessonTitle={activeLesson.title} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Lessons</h1>
          <p className="text-slate-400 mt-2">Explore and learn from your unit lessons</p>
        </div>
        <Button
          onClick={loadData}
          variant="outline"
          className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
          title="Refresh to see newly added units and lessons"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Units & Lessons List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Units ({units.length})</h2>
          {units.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
              <div>
                <p className="text-slate-400 font-medium">No units available yet</p>
                <p className="text-slate-500 text-xs mt-1">Units will appear here once your instructor creates them</p>
              </div>
              <p className="text-slate-600 text-xs">💡 Tip: Click "Refresh" to reload if your instructor just added content</p>
            </div>
          ) : (
            <div className="space-y-3">
              {units.map(unit => (
                <UnitSection
                  key={unit.id}
                  unit={unit}
                  lessons={lessons}
                  isExpanded={expandedUnits.includes(unit.id)}
                  activeLessonId={activeLessonId || undefined}
                  onToggle={() => toggleUnit(unit.id)}
                  onLessonClick={setActiveLessonId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Lesson Preview */}
        <div className="lg:col-span-2">
          {activeLesson ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              {/* Preview Header */}
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-2xl font-bold text-white">{activeLesson.title}</h2>
                <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                  <span>{activeLesson.slideCount || 0} slides</span>
                  <span>•</span>
                  <span>
                    Created {new Date(activeLesson.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Lesson Info */}
              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Description</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {activeLesson.content || 'This lesson was automatically generated from a PDF. Click "View Slides" to see the full presentation.'}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Slide Count</p>
                    <p className="text-lg font-semibold text-violet-400">
                      {activeLesson.slideCount || 0}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Estimated Duration</p>
                    <p className="text-lg font-semibold text-blue-400">
                      {Math.ceil((activeLesson.slideCount || 0) * 3)} min
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => setViewMode('viewer')}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  View Slides & Learn
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select a lesson to view details</p>
              {lessons.length === 0 && (
                <p className="text-slate-500 text-sm mt-2">
                  No lessons available in any unit yet
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
