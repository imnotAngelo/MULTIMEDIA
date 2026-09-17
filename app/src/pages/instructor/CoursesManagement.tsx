import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { 
  BookOpen, 
  FileText,
  ChevronDown,
  RefreshCw,
  Upload,
  Plus,
  Eye,
  Clock,
  Video,
  Link as LinkIcon,
  Edit2,
  Check,
  Trash2,
  X
} from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { authFetch } from '@/lib/authFetch';
import { notificationService } from '@/services/notificationService';
import { cn } from '@/lib/utils';
import { AetherLoader } from '@/components/AetherLoader';
import { SectionYearTargetPicker } from '@/components/SectionYearTargetPicker';
import { useCourseTreeStore } from '@/stores/courseTreeStore';

interface Unit {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  yearLevel?: number;
  section?: string;
}

interface Lesson {
  id: string;
  unitId: string;
  title: string;
  content: string;
  createdAt: string;
  slideCount?: number;
  slides?: any[];
  video_url?: string;
  app_link?: string;
  app_name?: string;
  pdfUrl?: string;
  originalFormat?: string;
}

function LessonItem({ lesson, isActive, onClick, onEditLesson, onDeleteLesson }: {
  lesson: Lesson;
  isActive?: boolean;
  onClick?: () => void;
  onEditLesson?: (lesson: Lesson) => void;
  onDeleteLesson?: (lessonId: string) => void;
}) {
  return (
    <div
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 border',
        isActive
          ? 'bg-violet-500/10 border-violet-500/30'
          : 'hover:bg-slate-800/50 border-transparent'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-center gap-3 text-left min-w-0"
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
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditLesson?.(lesson);
          }}
          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-violet-300 transition-colors"
          title="Edit lesson"
          aria-label={`Edit lesson ${lesson.title}`}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteLesson?.(lesson.id);
          }}
          className="p-1.5 rounded-md text-slate-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          title="Delete lesson"
          aria-label={`Delete lesson ${lesson.title}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Helper function to convert numbers to Roman numerals
const numberToRoman = (num: number): string => {
  const romanNumerals = [
    { value: 1000, numeral: 'M' },
    { value: 900, numeral: 'CM' },
    { value: 500, numeral: 'D' },
    { value: 400, numeral: 'CD' },
    { value: 100, numeral: 'C' },
    { value: 90, numeral: 'XC' },
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' }
  ];

  let result = '';
  let remaining = num;

  for (const { value, numeral } of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
};

function UnitSection({
  unit,
  lessons,
  isExpanded,
  activeLessonId,
  onToggle,
  onUnitClick,
  onLessonClick,
  onUploadClick,
  onEditUnit,
  onDeleteUnit,
  onEditLesson,
  onDeleteLesson,
}: {
  unit: Unit;
  lessons: Lesson[];
  isExpanded: boolean;
  activeLessonId?: string;
  onToggle: () => void;
  onUnitClick?: (unitId: string) => void;
  onLessonClick: (lessonId: string) => void;
  onUploadClick: (unitId: string) => void;
  onEditUnit?: (unit: Unit) => void;
  onDeleteUnit?: (unit: Unit) => void;
  onEditLesson?: (lesson: Lesson) => void;
  onDeleteLesson?: (lessonId: string) => void;
}) {
  const unitLessons = lessons.filter(l => l.unitId === unit.id);

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <div
        className={cn(
          'w-full flex items-center gap-2.5 p-3 transition-colors',
          'bg-slate-900/60 hover:bg-slate-800/50'
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (onUnitClick) {
              onUnitClick(unit.id);
            } else {
              onToggle();
            }
          }}
          className="flex flex-1 items-center gap-2.5 text-left min-w-0"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-500/10 text-violet-400">
            <BookOpen className="w-4 h-4" />
          </div>

          <div className="flex-1 text-left min-w-0">
            <h3 className="font-semibold text-slate-200 text-sm truncate">{unit.title}</h3>
            {unit.description && (
              <p className="text-xs text-slate-500 truncate">{unit.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-medium text-slate-400">
              {unitLessons.length} {unitLessons.length === 1 ? 'lesson' : 'lessons'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-1 hover:bg-slate-700/50 rounded text-slate-400"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform',
                  isExpanded && 'rotate-180'
                )}
              />
            </button>
          </div>
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditUnit?.(unit);
            }}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-violet-300 transition-colors"
            title="Edit unit"
            aria-label={`Edit unit ${unit.title}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteUnit?.(unit);
            }}
            className="p-1.5 rounded-md text-slate-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            title="Delete unit"
            aria-label={`Delete unit ${unit.title}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-800">
          {unitLessons.length > 0 && (
            <div className="p-2 space-y-1">
              {unitLessons.map(lesson => (
                <LessonItem
                  key={lesson.id}
                  lesson={lesson}
                  isActive={lesson.id === activeLessonId}
                  onClick={() => onLessonClick(lesson.id)}
                  onEditLesson={onEditLesson}
                  onDeleteLesson={onDeleteLesson}
                />
              ))}
            </div>
          )}

          <div className={cn("p-2", unitLessons.length > 0 && "border-t border-slate-800")}>
            <Button
              onClick={() => onUploadClick(unit.id)}
              variant="outline"
              className="w-full text-xs border-slate-700 text-slate-300 hover:bg-slate-800/50"
            >
              <Upload className="w-3 h-3 mr-1" />
              Add Lesson
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CoursesManagement() {
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const { loadUserCourseTree, setUserCourseTree } = useCourseTreeStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedUnitId = searchParams.get('unit');
  const requestedLessonId = searchParams.get('lesson');
  const requestedView = searchParams.get('view');
  const requestedAction = searchParams.get('action');
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedUnitForUpload, setSelectedUnitForUpload] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [uploadingLesson, setUploadingLesson] = useState(false);

  const [showCreateUnitDialog, setShowCreateUnitDialog] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [newUnitDescription, setNewUnitDescription] = useState('');
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [unitTargetYearLevels, setUnitTargetYearLevels] = useState<number[]>([]);
  const [unitTargetSections, setUnitTargetSections] = useState<string[]>([]);
  const [unitSectionInput, setUnitSectionInput] = useState('');
  const [lessonTargetYearLevels, setLessonTargetYearLevels] = useState<number[]>([]);
  const [lessonTargetSections, setLessonTargetSections] = useState<string[]>([]);
  const [lessonSectionInput, setLessonSectionInput] = useState('');

  // State for editing lesson metadata (video/app)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editVideoType, setEditVideoType] = useState<'url' | 'upload'>('url');
  const [editVideoFile, setEditVideoFile] = useState<File | null>(null);
  const [editAppLink, setEditAppLink] = useState('');
  const [editAppName, setEditAppName] = useState('');

  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [lessonToDeleteId, setLessonToDeleteId] = useState<string | null>(null);
  const [isDeletingUnit, setIsDeletingUnit] = useState(false);
  const [isDeletingLesson, setIsDeletingLesson] = useState(false);
  const [editUnitTitle, setEditUnitTitle] = useState('');
  const [editUnitDescription, setEditUnitDescription] = useState('');
  const [savingUnit, setSavingUnit] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const refreshSidebarCourseOutline = () => {
    window.dispatchEvent(new CustomEvent('aether-course-outline-refresh', {
      detail: { userId: user?.id ?? null },
    }));
  };

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated || !user?.id) {
      setUnits([]);
      setLessons([]);
      setExpandedUnits([]);
      setActiveLessonId(null);
      setLoading(false);
      return;
    }

    setUnits([]);
    setLessons([]);
    setExpandedUnits([]);
    setActiveLessonId(null);
    setLoading(true);
    loadData();
  }, [isHydrated, isAuthenticated, user?.id]);

  useEffect(() => {
    if (requestedAction === 'add-unit') {
      setActiveLessonId(null);
      setShowUploadDialog(false);
      setShowCreateUnitDialog(true);
      navigate('/instructor/courses', { replace: true });
      return;
    }

    if (requestedAction === 'add-lesson') {
      const targetUnitId = requestedUnitId || units[0]?.id || null;
      if (!targetUnitId) return;

      setActiveLessonId(null);
      setSelectedUnitForUpload(targetUnitId);
      setShowCreateUnitDialog(false);
      setShowUploadDialog(true);
      navigate(`/instructor/courses?view=units&unit=${encodeURIComponent(targetUnitId)}`, { replace: true });
    }
  }, [requestedAction, requestedUnitId, units, navigate]);

  useEffect(() => {
    const triggerQuickAction = () => {
      const quickActionKey = user?.id ? `aether-course-quick-action:${user.id}` : 'aether-course-quick-action';
      const rawAction = sessionStorage.getItem(quickActionKey) ?? sessionStorage.getItem('aether-course-quick-action');
      if (!rawAction) return;

      try {
        const quickAction = JSON.parse(rawAction) as { mode?: 'unit' | 'lesson'; unitId?: string | null };
        if (!quickAction.mode) return;

        if (quickAction.mode === 'unit') {
          setActiveLessonId(null);
          setShowCreateUnitDialog(true);
          setShowUploadDialog(false);
          sessionStorage.removeItem(quickActionKey);
          sessionStorage.removeItem('aether-course-quick-action');
          return;
        }

        const targetUnitId = quickAction.unitId || requestedUnitId || units[0]?.id || null;
        if (!targetUnitId) {
          sessionStorage.removeItem(quickActionKey);
          sessionStorage.removeItem('aether-course-quick-action');
          return;
        }

        setActiveLessonId(null);
        setSelectedUnitForUpload(targetUnitId);
        setShowUploadDialog(true);
        setShowCreateUnitDialog(false);
        sessionStorage.removeItem(quickActionKey);
        sessionStorage.removeItem('aether-course-quick-action');
      } catch {
        sessionStorage.removeItem(quickActionKey);
        sessionStorage.removeItem('aether-course-quick-action');
      }
    };

    triggerQuickAction();

    const onQuickAction = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode?: 'unit' | 'lesson'; unitId?: string | null }>;
      const quickAction = customEvent.detail;
      if (!quickAction?.mode) return;

      if (quickAction.mode === 'unit') {
        setActiveLessonId(null);
        setShowCreateUnitDialog(true);
        setShowUploadDialog(false);
        return;
      }

      const targetUnitId = quickAction.unitId || requestedUnitId || units[0]?.id || null;
      if (!targetUnitId) return;

      setActiveLessonId(null);
      setSelectedUnitForUpload(targetUnitId);
      setShowUploadDialog(true);
      setShowCreateUnitDialog(false);
    };

    window.addEventListener('aether-course-quick-action', onQuickAction);
    return () => window.removeEventListener('aether-course-quick-action', onQuickAction);
  }, [requestedUnitId, units, user?.id]);

  useEffect(() => {
    if (loading || showCreateUnitDialog || showUploadDialog) return;

    // 1. If a specific intended lesson was requested in URL query
    if (requestedLessonId && requestedUnitId) {
      const intendedLesson = lessons.find((lesson) => lesson.id === requestedLessonId && lesson.unitId === requestedUnitId);
      if (intendedLesson) {
        navigate(`/instructor/lesson/${intendedLesson.unitId}/${intendedLesson.id}`, { replace: true });
        return;
      }
    }

    // 2. If a specific unit was requested in URL query
    if (requestedUnitId) {
      setExpandedUnits((prev) => (prev.includes(requestedUnitId) ? prev : [...prev, requestedUnitId]));
      const unitLessons = lessons.filter((lesson) => lesson.unitId === requestedUnitId);
      if (unitLessons.length > 0) {
        // Proceed to the latest uploaded lesson in this unit
        const latestLesson = [...unitLessons].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0] || unitLessons[unitLessons.length - 1];
        navigate(`/instructor/lesson/${latestLesson.unitId}/${latestLesson.id}`, { replace: true });
        return;
      }
      // If the unit has no lessons, do not redirect to another unit! Stay to display the reminder.
      return;
    }

    // 3. Direct general /instructor/courses directly to view lesson (latest available lesson)
    if (lessons.length > 0) {
      const latestLesson = [...lessons].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0] || lessons[0];
      navigate(`/instructor/lesson/${latestLesson.unitId}/${latestLesson.id}`, { replace: true });
      return;
    }
  }, [loading, requestedUnitId, requestedLessonId, requestedView, units, lessons, navigate, showCreateUnitDialog, showUploadDialog]);

  const loadData = async () => {
    try {
      setLoading(true);
      const tree = await loadUserCourseTree(user?.id ?? null);
      const unitList: Unit[] = tree.units as Unit[];
      const allLessons: Lesson[] = tree.lessons as Lesson[];

      setUnits(unitList);
      setLessons(allLessons);
      setUserCourseTree(user?.id ?? null, tree);
      refreshSidebarCourseOutline();

      if (unitList.length > 0) {
        setExpandedUnits([unitList[0].id]);
        if (requestedView === 'units' || requestedUnitId || requestedLessonId) {
          setActiveLessonId(null);
        } else if (allLessons.length > 0) {
          setActiveLessonId(allLessons[0].id);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load lessons:', error);
      toast.error('Failed to load your courses');
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

  const handleCreateUnit = async () => {
    try {
      setCreatingUnit(true);
      
      // Generate auto-numbered title: UNIT I, UNIT II, etc.
      const nextUnitNumber = units.length + 1;
      const romanNumeral = numberToRoman(nextUnitNumber);
      const autoTitle = `UNIT ${romanNumeral}`;
      
      // Combine topic and description
      const fullDescription = newUnitTitle.trim() 
        ? `${newUnitTitle.trim()} - ${newUnitDescription.trim()}`
        : newUnitDescription.trim();

      const response = await authFetch('/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: autoTitle,
          description: fullDescription,
          targetSections: unitTargetSections,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        notificationService.notifyUnitAdded(autoTitle);
        setNewUnitTitle('');
        setNewUnitDescription('');
        setUnitTargetSections([]);
        setUnitTargetYearLevels([]);
        setShowCreateUnitDialog(false);
        await loadData();
      } else {
        console.error('❌ Create unit failed:', response.status, JSON.stringify(data.error || data));
        toast.error(data.error?.message || data.message || `Failed to create unit (status ${response.status})`);
      }
    } catch (error) {
      console.error('❌ Failed to create unit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create unit');
    } finally {
      setCreatingUnit(false);
    }
  };

  const handleUpdateLessonMetadata = async () => {
    if (!editingLessonId) return;

    try {
      setSavingMetadata(true);

      let videoUrlToSave = editVideoUrl;

      // Handle video file upload if selected
      if (editVideoType === 'upload' && editVideoFile) {
        setUploadingVideo(true);
        console.log('📹 Uploading video file:', editVideoFile.name);

        const formData = new FormData();
        formData.append('video', editVideoFile);

        const uploadResponse = await authFetch(
          `/units/lessons/${editingLessonId}/upload-video`,
          {
            method: 'POST',
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadData.success) {
          throw new Error(uploadData.error?.message || 'Failed to upload video');
        }

        videoUrlToSave = uploadData.data.video_url;
        console.log('✅ Video uploaded successfully:', videoUrlToSave);
        setUploadingVideo(false);
      }

      // Now update metadata with video URL and app info
      const response = await authFetch(`/units/lessons/${editingLessonId}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrlToSave || null,
          app_link: editAppLink || null,
          app_name: editAppName || null,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Lesson updated successfully');
      refreshSidebarCourseOutline();

        // Update the lesson in state
        setLessons(prev =>
          prev.map(lesson =>
            lesson.id === editingLessonId
              ? {
                  ...lesson,
                  video_url: videoUrlToSave || undefined,
                  app_link: editAppLink || undefined,
                  app_name: editAppName || undefined,
                }
              : lesson
          )
        );

        // Close edit mode
        setEditingLessonId(null);
        setEditVideoUrl('');
        setEditVideoFile(null);
        setEditAppLink('');
        setEditAppName('');
        setEditVideoType('url');
      } else {
        toast.error(data.error?.message || 'Failed to update lesson');
      }
    } catch (error) {
      console.error('❌ Failed to update lesson metadata:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update lesson');
    } finally {
      setSavingMetadata(false);
      setUploadingVideo(false);
    }
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditVideoUrl(lesson.video_url || '');
    setEditVideoType('url');
    setEditVideoFile(null);
    setEditAppLink(lesson.app_link || '');
    setEditAppName(lesson.app_name || '');
  };

  const handleDeleteUnit = (unit: Unit) => {
    setUnitToDelete(unit);
  };

  const handleConfirmDeleteUnit = async () => {
    if (!unitToDelete) return;

    try {
      setIsDeletingUnit(true);
      const response = await authFetch(`/units/${unitToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete unit');
      }

      toast.success(`"${unitToDelete.title}" deleted successfully`);
      setUnitToDelete(null);
      await loadData();
      refreshSidebarCourseOutline();
      setActiveLessonId(null);
    } catch (error) {
      console.error('❌ Failed to delete unit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete unit');
    } finally {
      setIsDeletingUnit(false);
    }
  };

  const handleEditUnit = (unit: Unit) => {
    setEditingUnitId(unit.id);
    setEditUnitTitle(unit.title);
    setEditUnitDescription(unit.description || '');
  };

  const handleUpdateUnit = async () => {
    if (!editingUnitId) {
      return;
    }

    try {
      setSavingUnit(true);
      const response = await authFetch(`/units/${editingUnitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editUnitTitle.trim(),
          description: editUnitDescription.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update unit');
      }

      toast.success('Unit updated successfully');
      setEditingUnitId(null);
      setEditUnitTitle('');
      setEditUnitDescription('');
      await loadData();
      refreshSidebarCourseOutline();
    } catch (error) {
      console.error('❌ Failed to update unit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update unit');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteLesson = (lessonId: string) => {
    setLessonToDeleteId(lessonId);
  };

  const handleConfirmDeleteLesson = async () => {
    if (!lessonToDeleteId) return;

    try {
      setIsDeletingLesson(true);
      const response = await authFetch(`/units/lessons/${lessonToDeleteId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete lesson');
      }

      toast.success('Lesson deleted successfully');
      const deletedId = lessonToDeleteId;
      setLessonToDeleteId(null);
      await loadData();
      refreshSidebarCourseOutline();
      if (activeLessonId === deletedId) {
        setActiveLessonId(null);
      }
    } catch (error) {
      console.error('❌ Failed to delete lesson:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete lesson');
    } finally {
      setIsDeletingLesson(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingLessonId(null);
    setEditVideoUrl('');
    setEditVideoFile(null);
    setEditAppLink('');
    setEditAppName('');
    setEditVideoType('url');
  };

  const handleUploadLesson = async () => {
    if (!lessonTitle.trim()) {
      toast.error('Lesson title is required');
      return;
    }
    if (!lessonFile) {
      toast.error('Please select a file');
      return;
    }
    if (!selectedUnitForUpload) {
      toast.error('Please select a unit');
      return;
    }

    try {
      setUploadingLesson(true);
      console.log('[UPLOAD_START] Uploading lesson:', lessonTitle);

      const formData = new FormData();
      formData.append('file', lessonFile);
      formData.append('title', lessonTitle.trim());
      formData.append('moduleId', selectedUnitForUpload);
      formData.append('targetSections', JSON.stringify(lessonTargetSections));

      const response = await authFetch('/lessons/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('[UPLOAD_RESPONSE]', response.status, data);

      if (response.ok && data.success) {
        console.log('[UPLOAD_SUCCESS] Lesson uploaded');
        toast.success('Lesson uploaded! PDF kept in original format.');

        // Get the unit name for the notification
        const unit = units.find(u => u.id === selectedUnitForUpload);
        const unitName = unit?.title || 'Unit';

        // Notify before clearing the form
        notificationService.notifyLessonAdded(lessonTitle, unitName);

        // Clear the form and reload
        setLessonTitle('');
        setLessonFile(null);
        setLessonTargetSections([]);
        setLessonTargetYearLevels([]);
        setShowUploadDialog(false);

        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[UPLOAD_VERIFY] Verifying lesson...');
        const verifyResponse = await authFetch(`/units/${selectedUnitForUpload}/lessons`);
        const verifyData = await verifyResponse.json();
        console.log('[UPLOAD_VERIFY_RESPONSE]', verifyData);

        console.log('[RELOAD_START] Reloading course data...');
        await loadData();
        refreshSidebarCourseOutline();
        console.log('[RELOAD_COMPLETE] Course data reloaded');
      } else {
        console.error('❌ Upload failed:', response.status, JSON.stringify(data.error || data));
        toast.error(data.error?.message || data.message || `Failed to upload lesson (status ${response.status})`);
      }
    } catch (error) {
      console.error('❌ Failed to upload lesson:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload lesson');
    } finally {
      setUploadingLesson(false);
    }
  };

  const selectLessonFile = (candidate?: File) => {
    if (!candidate) return;
    if (candidate.type !== 'application/pdf' && !candidate.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported');
      return;
    }
    if (candidate.size > 50 * 1024 * 1024) {
      toast.error('PDF files must be smaller than 50MB');
      return;
    }
    setLessonFile(candidate);
  };

  const activeLesson = lessons.find(l => l.id === activeLessonId);
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <AetherLoader label="Arranging your courses" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Units & lessons</h1>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadData}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Dialog open={showCreateUnitDialog} onOpenChange={setShowCreateUnitDialog}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                New Unit
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white/95 border-slate-200 text-slate-900 shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
              <DialogHeader>
                <DialogTitle>Create New Unit</DialogTitle>
                <DialogDescription>
                  Unit title will be auto-generated as UNIT I, UNIT II, etc.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                  <p className="text-sm text-slate-400 font-medium">
                    Auto-Generated Title: <span className="text-violet-400 font-semibold">UNIT {numberToRoman(units.length + 1)}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitTitle" className="text-slate-700 font-medium">Topic/Subject (Optional)</Label>
                  <Input
                    id="unitTitle"
                    placeholder="e.g., Advanced Python, Web Development, etc."
                    value={newUnitTitle}
                    onChange={(e) => setNewUnitTitle(e.target.value)}
                    className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitDescription" className="text-slate-700 font-medium">Description (Optional)</Label>
                  <Input
                    id="unitDescription"
                    placeholder="Brief description of the unit content"
                    value={newUnitDescription}
                    onChange={(e) => setNewUnitDescription(e.target.value)}
                    className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <SectionYearTargetPicker
                  yearLevels={[]}
                  onYearLevelsChange={setUnitTargetYearLevels}
                  sections={unitTargetSections}
                  onSectionsChange={setUnitTargetSections}
                  sectionInput={unitSectionInput}
                  onSectionInputChange={setUnitSectionInput}
                  showYearLevels={false}
                  sectionOptions={user?.teaching_sections ?? []}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateUnitDialog(false)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateUnit}
                    disabled={creatingUnit}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {creatingUnit && <AetherSpinner className="w-4 h-4 mr-2" />}
                    Create Unit
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {units.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <BookOpen className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">No units and lessons available</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              There are currently no units and lessons available. Create your first unit to get started.
            </p>
          </div>
          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => setShowCreateUnitDialog(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Unit
            </Button>
          </div>
        </div>
      ) : (() => {
        const currentSelectedUnit = units.find(u => u.id === requestedUnitId) || units[0];
        const currentUnitLessons = currentSelectedUnit ? lessons.filter(l => l.unitId === currentSelectedUnit.id) : [];

        if (currentSelectedUnit && currentUnitLessons.length === 0) {
          return (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BookOpen className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">No lessons available in {currentSelectedUnit.title}</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                  There are no lessons uploaded for this unit yet. Upload a lesson to get started.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <Button
                  onClick={() => {
                    setSelectedUnitForUpload(currentSelectedUnit.id);
                    setShowUploadDialog(true);
                  }}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Lesson
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleEditUnit(currentSelectedUnit)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Unit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDeleteUnit(currentSelectedUnit)}
                  className="border-red-900/40 text-red-400 hover:bg-red-950/40 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Unit
                </Button>
              </div>
            </div>
          );
        }

        if (lessons.length === 0) {
          return (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <BookOpen className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">No lessons available</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                  You have created units, but no lessons are available yet. Upload a lesson to get started.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <Button
                  onClick={() => {
                    setSelectedUnitForUpload(units[0]?.id || null);
                    setShowUploadDialog(true);
                  }}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Lesson
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateUnitDialog(true)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Unit
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-center py-20">
            <AetherSpinner className="w-8 h-8 text-violet-500" />
          </div>
        );
      })()}

      <Dialog open={!!editingUnitId} onOpenChange={(open) => {
        if (!open) {
          setEditingUnitId(null);
          setEditUnitTitle('');
          setEditUnitDescription('');
        }
      }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
            <DialogDescription>Update your unit details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editUnitTitle" className="text-slate-300">Unit Title</Label>
              <Input
                id="editUnitTitle"
                value={editUnitTitle}
                onChange={(e) => setEditUnitTitle(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="editUnitDescription" className="text-slate-300">Description</Label>
              <Input
                id="editUnitDescription"
                value={editUnitDescription}
                onChange={(e) => setEditUnitDescription(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingUnitId(null);
                  setEditUnitTitle('');
                  setEditUnitDescription('');
                }}
                className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateUnit} disabled={savingUnit} className="bg-violet-600 hover:bg-violet-700">
                {savingUnit ? <AetherSpinner className="w-4 h-4 mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLessonId} onOpenChange={(open) => {
        if (!open) handleCancelEdit();
      }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lesson Media & Links</DialogTitle>
            <DialogDescription>Attach or update video and tool links for this lesson.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-400 text-xs mb-2 block">Video Source</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditVideoType('url');
                    setEditVideoFile(null);
                  }}
                  className={`p-3 rounded-lg border text-xs font-medium transition-all ${
                    editVideoType === 'url'
                      ? 'border-violet-500/60 bg-violet-500/10 text-violet-300'
                      : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <LinkIcon className="w-3 h-3 mb-1" />
                  Video URL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditVideoType('upload');
                    setEditVideoUrl('');
                  }}
                  className={`p-3 rounded-lg border text-xs font-medium transition-all ${
                    editVideoType === 'upload'
                      ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                      : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Upload className="w-3 h-3 mb-1" />
                  Upload File
                </button>
              </div>
            </div>

            {editVideoType === 'url' && (
              <div>
                <Label htmlFor="dialogVideoUrl" className="text-slate-400 text-xs">Video URL (YouTube, Vimeo, etc.)</Label>
                <Input
                  id="dialogVideoUrl"
                  placeholder="https://youtube.com/watch?v=..."
                  value={editVideoUrl}
                  onChange={(e) => setEditVideoUrl(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 text-sm mt-1"
                />
              </div>
            )}

            {editVideoType === 'upload' && (
              <div className="space-y-2">
                <Label htmlFor="dialogVideoFile" className="text-slate-300 text-sm font-medium">Upload Video File</Label>
                <p className="text-xs text-slate-400">Supported: MP4, WebM, OGG, MOV (Max 500MB)</p>
                <input
                  id="dialogVideoFile"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setEditVideoFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-700 file:cursor-pointer"
                />
                {editVideoFile && (
                  <p className="text-xs text-emerald-400">Selected: {editVideoFile.name} ({(editVideoFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="dialogAppName" className="text-slate-400 text-xs">App/Tool Name (Optional)</Label>
              <Input
                id="dialogAppName"
                placeholder="e.g., Figma, Blender"
                value={editAppName}
                onChange={(e) => setEditAppName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 text-sm mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dialogAppLink" className="text-slate-400 text-xs">App/Tool Link (Optional)</Label>
              <Input
                id="dialogAppLink"
                placeholder="https://..."
                value={editAppLink}
                onChange={(e) => setEditAppLink(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 text-sm mt-1"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={savingMetadata || uploadingVideo}
                className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateLessonMetadata}
                disabled={savingMetadata || uploadingVideo}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {uploadingVideo ? (
                  <>
                    <AetherSpinner className="w-4 h-4 mr-2" />
                    Uploading...
                  </>
                ) : savingMetadata ? (
                  <>
                    <AetherSpinner className="w-4 h-4 mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-white/95 border-slate-200 text-slate-900 shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
          <DialogHeader>
            <DialogTitle>Add Lesson</DialogTitle>
            <DialogDescription>Upload a PDF to create a new lesson</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="unitSelect" className="text-slate-700 font-medium">Target Unit</Label>
              <select
                id="unitSelect"
                value={selectedUnitForUpload || ''}
                onChange={(e) => setSelectedUnitForUpload(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="" disabled>Select a unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lessonTitle" className="text-slate-700 font-medium">Lesson Title</Label>
              <Input
                id="lessonTitle"
                placeholder="Enter lesson title"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lessonFile" className="text-slate-700 font-medium">PDF File</Label>
              <Input
                id="lessonFile"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => selectLessonFile(e.currentTarget.files?.[0])}
                className="bg-slate-50 border-slate-300 text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-violet-700"
              />
              {lessonFile && <p className="text-xs text-slate-500">Selected: {lessonFile.name}</p>}
            </div>
            <SectionYearTargetPicker
              yearLevels={[]}
              onYearLevelsChange={setLessonTargetYearLevels}
              sections={lessonTargetSections}
              onSectionsChange={setLessonTargetSections}
              sectionInput={lessonSectionInput}
              onSectionInputChange={setLessonSectionInput}
              showYearLevels={false}
              sectionOptions={user?.teaching_sections ?? []}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowUploadDialog(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadLesson}
                disabled={uploadingLesson}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {uploadingLesson && <AetherSpinner className="w-4 h-4 mr-2" />}
                Upload Lesson
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Unit Confirmation Dialog */}
      <AlertDialog open={Boolean(unitToDelete)} onOpenChange={(open) => !open && setUnitToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="font-semibold text-slate-200">"{unitToDelete?.title}"</span>? This will archive the unit and all its lessons.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUnit} className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingUnit}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteUnit();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeletingUnit ? 'Deleting...' : 'Delete Unit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Lesson Confirmation Dialog */}
      <AlertDialog open={Boolean(lessonToDeleteId)} onOpenChange={(open) => !open && setLessonToDeleteId(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete this lesson? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLesson} className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingLesson}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteLesson();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeletingLesson ? 'Deleting...' : 'Delete Lesson'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}