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
  Clock
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📚 Fetching units from API...');
      
      const unitsResponse = await authFetch('/units');
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
    if (!newUnitTitle.trim()) {
      toast.error('Unit title is required');
      return;
    }

    try {
      setCreatingUnit(true);
      const response = await authFetch(`${API_BASE_URL}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newUnitTitle.trim(),
          description: newUnitDescription.trim(),
          targetSections: unitTargetSections,
          targetYearLevels: unitTargetYearLevels,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        notificationService.notifyUnitAdded(newUnitTitle);
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
                <DialogDescription>Add a new unit to organize your lessons</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="unitTitle" className="text-slate-300">Unit Title</Label>
                  <Input
                    id="unitTitle"
                    placeholder="e.g., Advanced Python"
                    value={newUnitTitle}
                    onChange={(e) => setNewUnitTitle(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
                <div>
                  <Label htmlFor="unitDescription" className="text-slate-300">Description</Label>
                  <Input
                    id="unitDescription"
                    placeholder="Brief description of the unit"
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