import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { authFetch } from '@/lib/authFetch';
import { API_BASE_URL } from '@/lib/apiConfig';
import { notificationService } from '@/services/notificationService';
import { cn } from '@/lib/utils';
import { AetherLoader } from '@/components/AetherLoader';
import { SectionYearTargetPicker } from '@/components/SectionYearTargetPicker';
import { FileToPptxUploader } from '@/components/FileToPptxUploader';

interface Unit {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  labExists?: boolean;
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
  onLessonClick,
  onUploadClick,
  onCreateLaboratory,
}: {
  unit: Unit;
  lessons: Lesson[];
  isExpanded: boolean;
  activeLessonId?: string;
  onToggle: () => void;
  onLessonClick: (lessonId: string) => void;
  onUploadClick: (unitId: string) => void;
  onCreateLaboratory: (unitId: string) => void;
}) {
  const unitLessons = lessons.filter(l => l.unitId === unit.id);

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
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
              {unitLessons.length}
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

          <div className="border-t border-slate-800 p-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={() => onUploadClick(unit.id)}
                variant="outline"
                className="w-full text-xs border-slate-700 text-slate-300 hover:bg-slate-800/50"
              >
                <Upload className="w-3 h-3 mr-1" />
                Add Lesson
              </Button>
              <Button
                onClick={() => onCreateLaboratory(unit.id)}
                disabled={unit.labExists || unitLessons.length === 0}
                className="w-full text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={unitLessons.length === 0 ? 'Upload at least one lesson first' : undefined}
              >
                {unit.labExists ? 'Laboratory created' : 'Create laboratory'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CoursesManagement() {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedUnitForUpload, setSelectedUnitForUpload] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
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
  const [lessonFormat, setLessonFormat] = useState<'pdf' | 'pptx'>('pdf');

  // State for editing lesson metadata (video/app)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editVideoType, setEditVideoType] = useState<'url' | 'upload'>('url');
  const [editVideoFile, setEditVideoFile] = useState<File | null>(null);
  const [editAppLink, setEditAppLink] = useState('');
  const [editAppName, setEditAppName] = useState('');
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📚 Fetching units from API...');
      
      const unitsResponse = await authFetch('/units', { cache: 'no-store' });
      const unitsData = await unitsResponse.json();
      console.log('✅ Units fetched:', unitsData.data || []);

      const unitList: Unit[] = unitsData.success ? (unitsData.data || []) : [];
      
      const unitListWithLabs = await Promise.all(unitList.map(async (unit) => {
        try {
          const existsRes = await authFetch(`/laboratories/exists/${unit.id}`);
          const existsJson = await existsRes.json();
          return { ...unit, labExists: !!existsJson?.data?.exists };
        } catch {
          return { ...unit, labExists: false };
        }
      }));

      setUnits(unitListWithLabs);

      const lessonResults = await Promise.all(unitListWithLabs.map(async (unit) => {
        const lessonsResponse = await authFetch(`/units/${unit.id}/lessons`);
        const lessonsData = await lessonsResponse.json();
        const unitLessons = lessonsData.success ? lessonsData.data || [] : [];
        console.log(`✅ Lessons for unit "${unit.title}": ${unitLessons.length}`);
        return unitLessons.map((lesson: any) => ({ ...lesson, unitId: unit.id }));
      }));
      const allLessons: Lesson[] = lessonResults.flat();

      console.log('✅ Total lessons loaded:', allLessons.length);
      
      // 🎬 VIDEO DEBUGGING: Log which lessons have videos
      const lessonsWithVideos = allLessons.filter(l => l.video_url);
      console.log(`🎬 Instructor view - Lessons WITH videos: ${lessonsWithVideos.length}`, lessonsWithVideos);
      
      allLessons.forEach((lesson) => {
        if (lesson.video_url) {
          console.log(`  ✅ "${lesson.title}" has video: ${lesson.video_url.substring(0, 80)}...`);
        }
      });
      
      setLessons(allLessons);

      if (unitList.length > 0) {
        setExpandedUnits([unitList[0].id]);
        if (allLessons.length > 0) {
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

      const response = await authFetch(`${API_BASE_URL}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: autoTitle,
          description: fullDescription,
          targetSections: unitTargetSections,
          targetYearLevels: unitTargetYearLevels,
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
          `${API_BASE_URL}/units/lessons/${editingLessonId}/upload-video`,
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
      const response = await authFetch(`${API_BASE_URL}/units/lessons/${editingLessonId}/metadata`, {
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

  const handleCancelEdit = () => {
    setEditingLessonId(null);
    setEditVideoUrl('');
    setEditVideoFile(null);
    setEditAppLink('');
    setEditAppName('');
    setEditVideoType('url');
  };

  const handleCreateLaboratory = async (unitId: string) => {
    try {
      const res = await authFetch('/laboratories/create-from-unit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Failed to create laboratory');
      }
      toast.success('Laboratory created');
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, labExists: true } : u)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create laboratory');
    }
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
      formData.append('description', lessonDescription.trim() || 'Lesson uploaded from PDF');
      formData.append('moduleId', selectedUnitForUpload);
      formData.append('targetSections', JSON.stringify(lessonTargetSections));
      formData.append('targetYearLevels', JSON.stringify(lessonTargetYearLevels));

      const response = await authFetch(`${API_BASE_URL}/lessons/upload-pdf`, {
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
        setLessonDescription('');
        setLessonFile(null);
        setLessonTargetSections([]);
        setLessonTargetYearLevels([]);
        setShowUploadDialog(false);

        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[UPLOAD_VERIFY] Verifying lesson...');
        const verifyResponse = await authFetch(`${API_BASE_URL}/units/${selectedUnitForUpload}/lessons`);
        const verifyData = await verifyResponse.json();
        console.log('[UPLOAD_VERIFY_RESPONSE]', verifyData);

        console.log('[RELOAD_START] Reloading course data...');
        await loadData();
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
          <h1 className="text-3xl font-bold text-white">UNIT MANAGEMENT</h1>
          <p className="text-slate-400 mt-2">Manage your units and lessons</p>
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
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
              <DialogHeader>
                <DialogTitle>Create New Unit</DialogTitle>
                <DialogDescription>
                  Unit title will be auto-generated as UNIT I, UNIT II, etc.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                  <p className="text-sm text-slate-400 font-medium">
                    Auto-Generated Title: <span className="text-violet-400 font-semibold">UNIT {numberToRoman(units.length + 1)}</span>
                  </p>
                </div>
                <div>
                  <Label htmlFor="unitTitle" className="text-slate-300">Topic/Subject (Optional)</Label>
                  <Input
                    id="unitTitle"
                    placeholder="e.g., Advanced Python, Web Development, etc."
                    value={newUnitTitle}
                    onChange={(e) => setNewUnitTitle(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
                <div>
                  <Label htmlFor="unitDescription" className="text-slate-300">Description (Optional)</Label>
                  <Input
                    id="unitDescription"
                    placeholder="Brief description of the unit content"
                    value={newUnitDescription}
                    onChange={(e) => setNewUnitDescription(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
                <SectionYearTargetPicker
                  yearLevels={unitTargetYearLevels}
                  onYearLevelsChange={setUnitTargetYearLevels}
                  sections={unitTargetSections}
                  onSectionsChange={setUnitTargetSections}
                  sectionInput={unitSectionInput}
                  onSectionInputChange={setUnitSectionInput}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Units ({units.length})</h2>
          {units.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
              <div>
                <p className="text-slate-400 font-medium">No units yet</p>
                <p className="text-slate-500 text-xs mt-1">Create your first unit to get started</p>
              </div>
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
                  onUploadClick={(unitId) => {
                    setSelectedUnitForUpload(unitId);
                    setShowUploadDialog(true);
                  }}
                  onCreateLaboratory={handleCreateLaboratory}
                />
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {activeLesson ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
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

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Description</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {activeLesson.content || 'Lesson details will appear here'}
                  </p>
                </div>

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

                {/* Current Video Preview */}
                {activeLesson.video_url && (
                  <div className="mb-6 rounded-lg overflow-hidden border border-slate-700/50 bg-gradient-to-b from-slate-900/50 to-slate-950">
                    <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/20 flex items-center justify-center border border-violet-500/30">
                        <Video className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">Current Video</p>
                        <p className="text-xs text-slate-500">Click play to preview</p>
                      </div>
                    </div>
                    <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
                      <video
                        controls
                        className="absolute inset-0 w-full h-full"
                        preload="metadata"
                      >
                        <source src={activeLesson.video_url} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                )}

                {editingLessonId === activeLesson.id ? (
                  <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4 space-y-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-300">Edit Lesson Media (Optional)</h4>
                    </div>

                    {/* Video Type Selection */}
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

                    {/* Video URL Input */}
                    {editVideoType === 'url' && (
                      <div>
                        <Label htmlFor="videoUrl" className="text-slate-400 text-xs">Video URL (YouTube, Vimeo, etc.)</Label>
                        <Input
                          id="videoUrl"
                          placeholder="https://youtube.com/watch?v=..."
                          value={editVideoUrl}
                          onChange={(e) => setEditVideoUrl(e.target.value)}
                          className="bg-slate-700 border-slate-600 text-slate-100 text-sm mt-1"
                        />
                      </div>
                    )}

                    {/* Video File Upload */}
                    {editVideoType === 'upload' && (
                      <div className="space-y-3">
                        <Label htmlFor="videoFile" className="text-slate-300 text-sm font-semibold">Upload Video File</Label>
                        <p className="text-xs text-slate-400">Supported: MP4, WebM, OGG, MOV, AVI, MKV (Maximum 500MB)</p>
                        
                        <div className="mt-3">
                          <input
                            id="videoFile"
                            type="file"
                            accept="video/*"
                            onChange={(e) => setEditVideoFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gradient-to-r file:from-violet-600 file:to-violet-700 file:text-white hover:file:from-violet-700 hover:file:to-violet-800 file:cursor-pointer transition-all"
                          />
                        </div>
                        
                        {editVideoFile && (
                          <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                                <Video className="w-5 h-5 text-emerald-400" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-emerald-300">✓ File Selected</p>
                                <p className="text-xs text-emerald-200/70">{editVideoFile.name}</p>
                                <p className="text-xs text-emerald-200/50 mt-1">{(editVideoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditVideoFile(null)}
                              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                            >
                              Remove Selection
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* App Link Section */}
                    <div className="space-y-2">
                      <Label htmlFor="appName" className="text-slate-400 text-xs">App/Tool Used Name (Optional)</Label>
                      <Input
                        id="appName"
                        placeholder="e.g., Adobe Photoshop, Figma, Blender"
                        value={editAppName}
                        onChange={(e) => setEditAppName(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-slate-100 text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="appLink" className="text-slate-400 text-xs">App/Tool Link (Optional)</Label>
                      <Input
                        id="appLink"
                        placeholder="https://www.adobe.com/products/photoshop"
                        value={editAppLink}
                        onChange={(e) => setEditAppLink(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-slate-100 text-sm mt-1"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdateLessonMetadata}
                        disabled={savingMetadata || uploadingVideo}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs"
                      >
                        {uploadingVideo ? (
                          <>
                            <AetherSpinner className="w-3 h-3 mr-1" />
                            Uploading video...
                          </>
                        ) : savingMetadata ? (
                          <>
                            <AetherSpinner className="w-3 h-3 mr-1" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        disabled={savingMetadata || uploadingVideo}
                        variant="outline"
                        className="flex-1 border-slate-600 text-slate-400 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {/* Display Video - File Upload or URL */}
                    {activeLesson.video_url && (
                      (() => {
                        const isFileUpload = activeLesson.video_url.includes('/lesson-videos/');
                        
                        // Function to get clean platform name
                        const getPlatformName = () => {
                          try {
                            const videoUrl = activeLesson.video_url || '';
                            const urlObj = new URL(videoUrl);
                            const hostname = urlObj.hostname.replace('www.', '').toLowerCase();
                            
                            // Map common video platforms to clean names
                            if (hostname.includes('youtube')) return 'YouTube';
                            if (hostname.includes('vimeo')) return 'Vimeo';
                            if (hostname.includes('youtu.be')) return 'YouTube';
                            if (hostname.includes('loom')) return 'Loom';
                            if (hostname.includes('wistia')) return 'Wistia';
                            if (hostname.includes('cloudinary')) return 'Cloudinary';
                            if (hostname.includes('bunny')) return 'Bunny CDN';
                            if (hostname.includes('dropbox')) return 'Dropbox';
                            if (hostname.includes('google')) return 'Google Drive';
                            if (hostname.includes('onedrive')) return 'OneDrive';
                            
                            // Return clean domain for others
                            return hostname.charAt(0).toUpperCase() + hostname.slice(1);
                          } catch {
                            return 'Video Link';
                          }
                        };
                        
                        return isFileUpload ? (
                          // For uploaded files: Show video title, not URL
                          <div className="bg-gradient-to-r from-violet-500/10 to-violet-600/10 border border-violet-500/30 rounded-lg p-4 hover:border-violet-500/50 transition-colors shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0 border border-violet-500/30">
                                  <Video className="w-5 h-5 text-violet-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Uploaded Video</p>
                                  <p className="text-sm font-semibold text-violet-300 truncate">{activeLesson.title}</p>
                                </div>
                              </div>
                              <a 
                                href={activeLesson.video_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
                              >
                                Open
                              </a>
                            </div>
                          </div>
                        ) : (
                          // For URL links: Show clean platform name with better design
                          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-600/10 border border-blue-500/30 rounded-lg p-4 hover:border-blue-500/50 transition-colors shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
                                  <LinkIcon className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">External Video</p>
                                  <p className="text-sm font-semibold text-blue-300 truncate">{getPlatformName()}</p>
                                </div>
                              </div>
                              <a 
                                href={activeLesson.video_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
                              >
                                Visit
                              </a>
                            </div>
                          </div>
                        );
                      })()
                    )}

                    {/* Display App Link */}
                    {activeLesson.app_link && (
                      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-600/10 border border-emerald-500/30 rounded-lg p-4 hover:border-emerald-500/50 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                              <LinkIcon className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-400 font-medium">{activeLesson.app_name || 'App/Tool'}</p>
                              <p className="text-sm font-semibold text-emerald-300 truncate">{activeLesson.app_name || 'External Link'}</p>
                            </div>
                          </div>
                          <a 
                            href={activeLesson.app_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                          >
                            Visit
                          </a>
                        </div>
                      </div>
                    )}

                    {!activeLesson.video_url && !activeLesson.app_link && (
                      <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-500">No video or app link added yet</p>
                      </div>
                    )}

                    <Button
                      onClick={() => handleEditLesson(activeLesson)}
                      size="sm"
                      variant="outline"
                      className="w-full border-slate-600 text-slate-400 text-xs"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit Media & Tools
                    </Button>
                  </div>
                )}

                <Button 
                  className="w-full bg-violet-600 hover:bg-violet-700"
                  onClick={() => {
                    if (activeLesson) {
                      navigate(`/instructor/lesson/${activeLesson.unitId}/${activeLesson.id}`);
                    }
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Slides
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center space-y-3">
              <FileText className="w-8 h-8 text-slate-600 mx-auto" />
              <div>
                <p className="text-slate-400 font-medium">No lesson selected</p>
                <p className="text-slate-500 text-xs mt-1">Select a lesson from the list to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Add Lesson</DialogTitle>
            <DialogDescription>Upload a PDF to create a new lesson, or convert a file to PowerPoint</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Lesson format">
              <button
                type="button"
                role="radio"
                aria-checked={lessonFormat === 'pdf'}
                onClick={() => setLessonFormat('pdf')}
                className={`flex items-center justify-center gap-2 h-10 rounded-md border text-sm font-medium transition-all ${
                  lessonFormat === 'pdf'
                    ? 'border-violet-500/60 bg-violet-500/10 text-white'
                    : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                Continue with PDF
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lessonFormat === 'pptx'}
                onClick={() => setLessonFormat('pptx')}
                className={`flex items-center justify-center gap-2 h-10 rounded-md border text-sm font-medium transition-all ${
                  lessonFormat === 'pptx'
                    ? 'border-cyan-400/60 bg-cyan-400/10 text-white'
                    : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                Convert to PowerPoint
              </button>
            </div>

            {lessonFormat === 'pptx' ? (
              <FileToPptxUploader unitId={selectedUnitForUpload || undefined} />
            ) : (
            <>
            <div>
              <Label htmlFor="lessonTitle" className="text-slate-300">Lesson Title</Label>
              <Input
                id="lessonTitle"
                placeholder="Enter lesson title"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="lessonDescription" className="text-slate-300">Description (Optional)</Label>
              <Input
                id="lessonDescription"
                placeholder="Brief lesson description"
                value={lessonDescription}
                onChange={(e) => setLessonDescription(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="lessonFile" className="text-slate-300">PDF File</Label>
              <Input
                id="lessonFile"
                type="file"
                accept=".pdf"
                onChange={(e) => setLessonFile(e.currentTarget.files?.[0] || null)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <SectionYearTargetPicker
              yearLevels={lessonTargetYearLevels}
              onYearLevelsChange={setLessonTargetYearLevels}
              sections={lessonTargetSections}
              onSectionsChange={setLessonTargetSections}
              sectionInput={lessonSectionInput}
              onSectionInputChange={setLessonSectionInput}
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
            </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}