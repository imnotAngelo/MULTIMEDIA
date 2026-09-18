import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePageCache } from '@/stores/pageCacheStore';
import { notificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Beaker,
  Edit2,
  Trash2,
  ExternalLink,
  RefreshCw,
  Loader2,
  X,
  Link,
  Calendar,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Monitor,
  Layers,
  ChevronRight,
  ArrowLeft,
  Check,
  Award,
} from 'lucide-react';
import { AetherLoader } from '@/components/AetherLoader';
import { authFetch } from '@/lib/authFetch';
import { toast } from 'sonner';
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

interface Laboratory {
  id: string;
  title: string;
  description: string;
  platform: string;
  platformUrl: string;
  unitId: string;
  unitName: string;
  lessonId: string;
  lessonTitle: string;
  dueDate: string;
  allowLateSubmissions?: boolean;
  points: number;
  targetSections?: string[];
  targetYearLevels?: number[];
  createdAt: string;
}

interface Unit {
  id: string;
  title: string;
}

interface Lesson {
  id: string;
  title: string;
}

const PLATFORM_OPTIONS = [
  { label: 'Canva (Free)', value: 'Canva', color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' },
  { label: 'Figma (Free)', value: 'Figma', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
  { label: 'Adobe Express – Photo (Free)', value: 'Adobe Photoshop', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
  { label: 'Adobe Express – Design (Free)', value: 'Adobe Illustrator', color: 'bg-orange-500/10 border-orange-500/30 text-orange-400' },
  { label: 'Adobe Express – Video (Free)', value: 'Adobe Premiere Pro', color: 'bg-violet-500/10 border-violet-500/30 text-violet-400' },
  { label: 'Canva Video – Motion (Free)', value: 'Adobe After Effects', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' },
  { label: 'DaVinci Resolve (Free)', value: 'DaVinci Resolve', color: 'bg-rose-500/10 border-rose-500/30 text-rose-400' },
  { label: 'Google Slides (Free)', value: 'Google Slides', color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
  { label: 'PowerPoint Online (Free)', value: 'PowerPoint', color: 'bg-red-500/10 border-red-500/30 text-red-400' },
  { label: 'Other', value: 'Other', color: 'bg-slate-500/10 border-slate-500/30 text-slate-400' },
];

// Free-tier / free web versions of each platform
const PLATFORM_URLS: Record<string, string> = {
  'Canva': 'https://www.canva.com/',                                   // free forever plan
  'Figma': 'https://www.figma.com/',                                   // free starter plan
  'Adobe Photoshop': 'https://express.adobe.com/',                    // Adobe Express – free web photo editor
  'Adobe Illustrator': 'https://express.adobe.com/',                  // Adobe Express – free web vector editor
  'Adobe Premiere Pro': 'https://express.adobe.com/sp/design/video',  // Adobe Express Video – free
  'Adobe After Effects': 'https://www.canva.com/video-editor/',       // Canva Video – free AE-like motion tool
  'DaVinci Resolve': 'https://www.blackmagicdesign.com/products/davinciresolve', // free desktop version
  'Google Slides': 'https://slides.google.com/',                      // free with Google account
  'PowerPoint': 'https://www.microsoft365.com/launch/powerpoint',     // free web version via M365
};

const getPlatformColor = (platform: string) => {
  const found = PLATFORM_OPTIONS.find(p => p.value === platform);
  return found?.color ?? 'bg-slate-500/10 border-slate-500/30 text-slate-400';
};

interface FormData {
  title: string;
  description: string;
  platform: string;
  platformUrl: string;
  unitId: string;
  lessonId: string;
  dueDate: string;
  allowLateSubmissions: boolean;
  points: number;
  targetSections: string[];
}

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  platform: 'Canva',
  platformUrl: '',
  unitId: '',
  lessonId: '',
  dueDate: '',
  allowLateSubmissions: false,
  points: 100,
  targetSections: [],
};

export function LaboratoriesManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const pageCache = usePageCache();
  const CACHE_KEY = `labs-management:${user?.id ?? 'anon'}`;

  // Detect whether we're on the /create route → show full-page wizard
  const isCreateRoute = location.pathname === '/instructor/laboratories/create';
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  const [laboratories, setLaboratories] = useState<Laboratory[]>(() => {
    const cached = pageCache.get<{ laboratories: Laboratory[]; units: Unit[] }>(CACHE_KEY);
    return cached.data?.laboratories ?? [];
  });
  const [units, setUnits] = useState<Unit[]>(() => {
    const cached = pageCache.get<{ laboratories: Laboratory[]; units: Unit[] }>(CACHE_KEY);
    return cached.data?.units ?? [];
  });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [loading, setLoading] = useState(() => {
    const cached = pageCache.get<{ laboratories: Laboratory[]; units: Unit[] }>(CACHE_KEY);
    return cached.data === null;
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [labToDelete, setLabToDelete] = useState<Laboratory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const cached = pageCache.get(CACHE_KEY);
    if (cached.fresh) { setLoading(false); return; }
    loadData(cached.data !== null);
  }, [user?.id]);

  // Auto-open wizard when navigating directly to /instructor/laboratories/create
  useEffect(() => {
    if (isCreateRoute && !showCreateForm) {
      setFormData(EMPTY_FORM);
      setEditingId(null);
      setFormError('');
      setWizardStep(1);
      setShowCreateForm(true);
      refreshUnits();
    }
  }, [isCreateRoute]);

  useEffect(() => {
    if (!showCreateForm || !formData.unitId) {
      setLessons([]);
      setLessonsLoading(false);
      return;
    }

    let cancelled = false;
    setLessonsLoading(true);
    authFetch(`/units/${formData.unitId}/lessons`)
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json.success) {
          const message = typeof json.error === 'string'
            ? json.error
            : json.error?.message;
          throw new Error(message || 'Failed to load lessons for this unit.');
        }
        return (json.data ?? []).map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
        }));
      })
      .then(nextLessons => {
        if (cancelled) return;
        setLessons(nextLessons);
        setFormData(current => (
          current.lessonId && !nextLessons.some((lesson: Lesson) => lesson.id === current.lessonId)
            ? { ...current, lessonId: '' }
            : current
        ));
      })
      .catch(error => {
        if (cancelled) return;
        setLessons([]);
        setFormError(error instanceof Error ? error.message : 'Could not load lessons for this unit.');
      })
      .finally(() => {
        if (!cancelled) setLessonsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formData.unitId, showCreateForm]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [labsResponse, unitsResponse] = await Promise.all([
        authFetch('/laboratories/metadata'),
        authFetch('/units'),
      ]);
      const labsJson = await labsResponse.json();
      const unitsJson = await unitsResponse.json();
      if (!labsResponse.ok || !labsJson.success) {
        const message = typeof labsJson.error === 'string'
          ? labsJson.error
          : labsJson.error?.message;
        throw new Error(message || `Laboratory request failed (${labsResponse.status})`);
      }
      const labsList = labsJson.data ?? [];
      const unitsList = unitsJson.success ? (unitsJson.data ?? []).map((unit: any) => ({ id: unit.id, title: unit.title })) : [];
      setLaboratories(labsList);
      setUnits(unitsList);
      // Save to cache for instant display on revisit
      pageCache.set(CACHE_KEY, { laboratories: labsList, units: unitsList });
    } catch (error) {
      setLaboratories([]);
      setUnits([]);
      setFormError(error instanceof Error ? error.message : 'Could not load laboratories from Supabase.');
    }
    setLoading(false);
  };

  // Reload the units list so newly-created units/lessons are available to link, since
  // the list is otherwise only fetched once when the page first mounts.
  const refreshUnits = async () => {
    try {
      const unitsResponse = await authFetch('/units');
      const unitsJson = await unitsResponse.json();
      setUnits(unitsJson.success ? (unitsJson.data ?? []).map((unit: any) => ({ id: unit.id, title: unit.title })) : []);
    } catch {
      // Keep whatever units were already loaded if the refresh fails.
    }
  };

  const handleOpenCreate = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setFormError('');
    setShowCreateForm(true);
    setWizardStep(1);
    refreshUnits();
    navigate('/instructor/laboratories/create');
  };

  const handleOpenEdit = (lab: Laboratory) => {
    setFormData({
      title: lab.title,
      description: lab.description,
      platform: lab.platform,
      platformUrl: lab.platformUrl,
      unitId: lab.unitId,
      lessonId: lab.lessonId,
      dueDate: lab.dueDate,
      allowLateSubmissions: lab.allowLateSubmissions ?? false,
      points: lab.points ?? 100,
      targetSections: lab.targetSections ?? [],
    });
    setEditingId(lab.id);
    setFormError('');
    setShowCreateForm(true);
    setWizardStep(1);
    refreshUnits();
  };

  const handleCloseForm = () => {
    setShowCreateForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setWizardStep(1);
    if (isCreateRoute) navigate('/instructor/laboratories');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!formData.platformUrl.trim()) {
      setFormError('Platform link is required.');
      return;
    }

    const selectedUnit = units.find(u => u.id === formData.unitId);
    const selectedLesson = lessons.find(l => l.id === formData.lessonId);

    try {
      const response = await authFetch('/laboratories/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId ?? undefined,
          title: formData.title,
          description: formData.description,
          platform: formData.platform,
          platformUrl: formData.platformUrl,
          unitId: formData.unitId,
          unitName: selectedUnit?.title ?? '',
          lessonId: formData.lessonId,
          lessonTitle: selectedLesson?.title ?? '',
          dueDate: formData.dueDate,
          allowLateSubmissions: formData.allowLateSubmissions,
          points: formData.points,
          targetSections: formData.targetSections,
          targetYearLevels: [],
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error?.message || 'Failed to save laboratory');
      const savedLab = json.data as Laboratory;
      setLaboratories(current => editingId
        ? current.map(lab => lab.id === editingId ? savedLab : lab)
        : [savedLab, ...current]);
      if (!editingId) notificationService.notifyLabAdded(savedLab.title, savedLab.platform);

      // Auto-open the selected platform/project so the instructor can start preparing it
      const launchUrl = (savedLab.platformUrl || PLATFORM_URLS[savedLab.platform] || '').trim();
      if (!editingId && launchUrl) {
        try {
          window.open(launchUrl, '_blank', 'noopener,noreferrer');
        } catch {
          // Pop-up blocked — silent fail; the link is still saved on the card.
        }
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save laboratory');
      return;
    }

    handleCloseForm();
  };

  const handleConfirmDelete = async () => {
    if (!labToDelete) return;
    try {
      setIsDeleting(true);
      const response = await authFetch(`/laboratories/${labToDelete.id}`, { method: 'DELETE' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error?.message || 'Failed to delete laboratory');
      setLaboratories(current => current.filter(lab => lab.id !== labToDelete.id));
      toast.success(`"${labToDelete.title}" deleted successfully`);
      setLabToDelete(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete laboratory';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No due date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDaysLabel = (dateStr: string) => {
    if (!dateStr) return null;
    const today = new Date();
    const due = new Date(dateStr);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-400' };
    if (diff === 0) return { text: 'Due today', color: 'text-amber-400' };
    if (diff <= 3) return { text: `Due in ${diff}d`, color: 'text-amber-400' };
    return { text: `Due in ${diff}d`, color: 'text-slate-400' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Laboratories</h1>
          <p className="text-slate-400 mt-1 text-sm">Create and manage student laboratory activities</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { pageCache.invalidate(CACHE_KEY); loadData(false); }}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Laboratory
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Beaker className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{laboratories.length}</div>
          <p className="text-slate-500 text-xs mt-1">Total Laboratories</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Monitor className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {new Set(laboratories.map(l => l.platform)).size}
          </div>
          <p className="text-slate-500 text-xs mt-1">Platforms Used</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {new Set(laboratories.filter(l => l.unitId).map(l => l.unitId)).size}
          </div>
          <p className="text-slate-500 text-xs mt-1">Units Covered</p>
        </div>
      </div>

      {/* ── Create/Edit Wizard (full-page on /create route, modal on edit) ── */}
      {showCreateForm && (
        isCreateRoute ? (
          /* ─── FULL-PAGE WIZARD (Create mode) ─────────────────────────── */
          <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

              {/* Top nav */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Laboratories
                </button>
                <div className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 font-medium border border-violet-500/20">
                  Laboratory Studio
                </div>
              </div>

              {/* Step indicator */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl px-6 py-4">
                <div className="flex items-center justify-between max-w-lg mx-auto">
                  {[
                    { n: 1, label: 'Lab Details' },
                    { n: 2, label: 'Platform & Link' },
                    { n: 3, label: 'Schedule & Audience' },
                  ].map(({ n, label }, idx, arr) => (
                    <div key={n} className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                          wizardStep > n
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                            : wizardStep === n
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {wizardStep > n ? <Check className="w-4 h-4" /> : n}
                        </div>
                        <span className={`text-sm font-semibold hidden sm:block ${wizardStep === n ? 'text-violet-400' : 'text-slate-500'}`}>
                          {label}
                        </span>
                      </div>
                      {idx < arr.length - 1 && (
                        <ChevronRight className="w-5 h-5 text-slate-600 ml-2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Error banner */}
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-sm">{formError}</p>
                </div>
              )}

              {/* ── STEP 1: Lab Details ── */}
              {wizardStep === 1 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-400">
                      <Beaker className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Step 1: Lab Details</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Name your laboratory and link it to an instructional unit and lesson.</p>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Laboratory Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Logo Design using Canva"
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all text-sm"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                      placeholder="Instructions or objectives for this laboratory..."
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all text-sm resize-none"
                    />
                  </div>

                  {/* Unit */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                      Link to Unit <span className="text-slate-500 font-normal">(optional)</span>
                    </label>
                    <select
                      value={formData.unitId}
                      onChange={e => setFormData(f => ({ ...f, unitId: e.target.value, lessonId: '' }))}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none text-sm"
                    >
                      <option value="">— No unit —</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                    </select>
                  </div>

                  {/* Lesson */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                      Link to Lesson <span className="text-slate-500 font-normal">(optional)</span>
                    </label>
                    <select
                      value={formData.lessonId}
                      onChange={e => setFormData(f => ({ ...f, lessonId: e.target.value }))}
                      disabled={!formData.unitId || lessonsLoading}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none text-sm disabled:opacity-50"
                    >
                      <option value="">
                        {!formData.unitId ? 'Choose a unit first' : lessonsLoading ? 'Loading lessons...' : lessons.length === 0 ? 'No lessons in this unit' : '— No lesson —'}
                      </option>
                      {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  </div>

                  {/* Nav */}
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        if (!formData.title.trim()) { setFormError('Laboratory title is required.'); return; }
                        setFormError('');
                        setWizardStep(2);
                      }}
                      className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                    >
                      Next: Platform & Link <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Platform & Link ── */}
              {wizardStep === 2 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Step 2: Platform & Link</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Choose the tool students will use and paste the activity link.</p>
                    </div>
                  </div>

                  {/* Platform Cards */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Select Platform / Tool <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PLATFORM_OPTIONS.map(p => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => {
                            const autoUrl = PLATFORM_URLS[p.value] ?? '';
                            setFormData(f => ({
                              ...f,
                              platform: p.value,
                              platformUrl: !f.platformUrl || Object.values(PLATFORM_URLS).includes(f.platformUrl) ? autoUrl : f.platformUrl,
                            }));
                          }}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all ${
                            formData.platform === p.value
                              ? `${p.color} ring-2 ring-violet-500`
                              : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {formData.platform === p.value && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                          <span className="truncate">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Platform URL */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Activity / Platform Link <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="url"
                        value={formData.platformUrl}
                        onChange={e => setFormData(f => ({ ...f, platformUrl: e.target.value }))}
                        placeholder="https://www.canva.com/design/..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all text-sm"
                      />
                    </div>
                    <p className="text-slate-500 text-xs mt-1">Paste the direct link to the platform or a specific activity template.</p>
                  </div>

                  {/* Nav */}
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" onClick={() => { setFormError(''); setWizardStep(1); }} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!formData.platformUrl.trim()) { setFormError('Platform link is required.'); return; }
                        setFormError('');
                        setWizardStep(3);
                      }}
                      className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                    >
                      Next: Schedule & Audience <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Schedule & Audience ── */}
              {wizardStep === 3 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Step 3: Schedule & Audience</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Set the due date, points, and which sections can access this lab.</p>
                    </div>
                  </div>

                  {/* Due Date + Points */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        <Calendar className="w-3.5 h-3.5 inline mr-1" />Due Date
                      </label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={e => setFormData(f => ({ ...f, dueDate: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        <Award className="w-3.5 h-3.5 inline mr-1" />Points
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={formData.points}
                        onChange={e => setFormData(f => ({ ...f, points: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none text-sm"
                      />
                      <p className="text-slate-500 text-xs mt-1">Max score for this lab</p>
                    </div>
                  </div>

                  {/* Allow Late */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setFormData(f => ({ ...f, allowLateSubmissions: !f.allowLateSubmissions }))}
                      className={`w-10 h-5 rounded-full transition-colors ${formData.allowLateSubmissions ? 'bg-violet-600' : 'bg-slate-700'} relative flex-shrink-0`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${formData.allowLateSubmissions ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm text-slate-300">Allow late submissions after the due date</span>
                  </label>

                  {/* Section picker */}
                  {user?.teaching_sections && user.teaching_sections.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">Assign to Sections</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Select which sections can access this laboratory.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {user.teaching_sections.map((section: string) => {
                          const isSelected = formData.targetSections.includes(section);
                          return (
                            <button
                              key={section}
                              type="button"
                              onClick={() => setFormData(f => ({
                                ...f,
                                targetSections: isSelected
                                  ? f.targetSections.filter(s => s !== section)
                                  : [...f.targetSections, section],
                              }))}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                isSelected
                                  ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-500/30'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                              {section}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Summary card */}
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-slate-200 mb-3">Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-500">Title:</span> <span className="text-slate-200 font-medium">{formData.title || '—'}</span></div>
                      <div><span className="text-slate-500">Platform:</span> <span className="text-slate-200 font-medium">{formData.platform}</span></div>
                      <div><span className="text-slate-500">Points:</span> <span className="text-slate-200 font-medium">{formData.points}</span></div>
                      <div><span className="text-slate-500">Due:</span> <span className="text-slate-200 font-medium">{formData.dueDate || 'No date set'}</span></div>
                    </div>
                  </div>

                  {/* Nav */}
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" onClick={() => { setFormError(''); setWizardStep(2); }} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => handleSubmit(e as any)}
                      className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                    >
                      <Beaker className="w-4 h-4" />
                      Create Laboratory
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          /* ─── MODAL (Edit mode) ───────────────────────────────────────── */
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="my-3 sm:my-6 bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] shadow-2xl flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                    <Beaker className="w-4 h-4 text-violet-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Edit Laboratory</h2>
                </div>
                <button onClick={handleCloseForm} className="text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="overflow-y-auto">
                <div className="p-5 sm:p-6 space-y-4">
                  {formError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-red-400 text-sm">{formError}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Laboratory Title <span className="text-red-400">*</span></label>
                    <input type="text" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Logo Design using Canva" className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                    <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Instructions or objectives..." rows={3} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 text-sm resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Platform / Tool</label>
                    <select value={formData.platform} onChange={e => { const p = e.target.value; setFormData(f => ({ ...f, platform: p, platformUrl: !f.platformUrl || Object.values(PLATFORM_URLS).includes(f.platformUrl) ? (PLATFORM_URLS[p] ?? '') : f.platformUrl })); }} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm">
                      {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Platform Link <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type="url" value={formData.platformUrl} onChange={e => setFormData(f => ({ ...f, platformUrl: e.target.value }))} placeholder="https://..." className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Link to Unit</label>
                    <select value={formData.unitId} onChange={e => setFormData(f => ({ ...f, unitId: e.target.value, lessonId: '' }))} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm">
                      <option value="">— No unit —</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Link to Lesson</label>
                    <select value={formData.lessonId} onChange={e => setFormData(f => ({ ...f, lessonId: e.target.value }))} disabled={!formData.unitId || lessonsLoading} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm disabled:opacity-60">
                      <option value="">{!formData.unitId ? 'Choose a unit first' : lessonsLoading ? 'Loading...' : lessons.length === 0 ? 'No lessons' : '— No lesson —'}</option>
                      {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date</label>
                      <input type="date" value={formData.dueDate} onChange={e => setFormData(f => ({ ...f, dueDate: e.target.value }))} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Points</label>
                      <input type="number" min={1} max={1000} value={formData.points} onChange={e => setFormData(f => ({ ...f, points: Math.max(1, parseInt(e.target.value) || 1) }))} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={formData.allowLateSubmissions} onChange={e => setFormData(f => ({ ...f, allowLateSubmissions: e.target.checked }))} className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-violet-500" />
                    Allow late submissions
                  </label>
                  {user?.teaching_sections && user.teaching_sections.length > 0 && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-slate-200">Assign to Sections</h4>
                      <div className="flex flex-wrap gap-3">
                        {user.teaching_sections.map((section: string) => (
                          <label key={section} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={formData.targetSections.includes(section)} onChange={(ev) => setFormData(f => ({ ...f, targetSections: ev.target.checked ? [...f.targetSections, section] : f.targetSections.filter(s => s !== section) }))} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-500" />
                            <span className="text-sm text-slate-300">{section}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="sticky bottom-0 flex justify-end gap-3 px-5 sm:px-6 py-4 bg-slate-900 border-t border-slate-800">
                  <Button type="button" variant="outline" onClick={handleCloseForm} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
                  <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white">Save Changes</Button>
                </div>
              </form>
            </div>
          </div>
        )
      )}

      {/* List */}
      {loading ? (
        <AetherLoader label="Opening your laboratory network" />
      ) : laboratories.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <Beaker className="w-7 h-7 text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Laboratories Yet</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Create your first laboratory activity and link it to a platform like Canva, Figma, or Adobe.
          </p>
          <Button
            onClick={handleOpenCreate}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Laboratory
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {laboratories.map((lab, index) => {
            const isExpanded = expandedId === lab.id;
            const daysLabel = getDaysLabel(lab.dueDate);

            return (
              <div
                key={`${lab.id || 'laboratory'}-${index}`}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_18px_40px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all hover:border-cyan-400/40 hover:bg-white/10"
              >
                {/* Row Header */}
                <div className="flex items-start gap-4 p-5">
                  {/* Icon */}
                  <div className={`p-2.5 rounded-lg border shrink-0 ${getPlatformColor(lab.platform)}`}>
                    <Beaker className="w-5 h-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white text-base leading-tight">{lab.title}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getPlatformColor(lab.platform)}`}>
                        {lab.platform}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      {lab.unitName && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {lab.unitName}
                        </span>
                      )}
                      {lab.lessonTitle && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {lab.lessonTitle}
                        </span>
                      )}
                      {lab.dueDate && (
                        <span className={`flex items-center gap-1 ${daysLabel?.color ?? 'text-slate-400'}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(lab.dueDate)}
                          {daysLabel && <span className="ml-1 text-xs">({daysLabel.text})</span>}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        {lab.points ?? 100} pts
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={lab.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open platform"
                      className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleOpenEdit(lab)}
                      className="p-2 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setLabToDelete(lab)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : lab.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 border-t border-slate-800/60 mt-1 space-y-4">
                    {lab.description && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide font-medium">Description</p>
                        <p className="text-slate-300 text-sm">{lab.description}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide font-medium">Platform Link</p>
                      <a
                        href={lab.platformUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm break-all group"
                      >
                        <Link className="w-3.5 h-3.5 shrink-0" />
                        <span className="group-hover:underline">{lab.platformUrl}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide font-medium">Created</p>
                      <p className="text-slate-400 text-sm">{formatDate(lab.createdAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(labToDelete)} onOpenChange={(open) => !open && setLabToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Laboratory</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="font-semibold text-slate-200">"{labToDelete?.title}"</span>? This will permanently remove the laboratory activity. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete Laboratory'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
