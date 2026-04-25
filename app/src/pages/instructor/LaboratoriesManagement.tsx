import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
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
} from 'lucide-react';

interface Laboratory {
  id: string;
  title: string;
  description: string;
  platform: string;
  platformUrl: string;
  unitId: string;
  unitName: string;
  dueDate: string;
  points: number;
  createdAt: string;
}

interface Unit {
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

const STORAGE_KEY = 'instructor_laboratories';

const loadFromStorage = (): Laboratory[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (labs: Laboratory[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(labs));
};

interface FormData {
  title: string;
  description: string;
  platform: string;
  platformUrl: string;
  unitId: string;
  dueDate: string;
  points: number;
}

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  platform: 'Canva',
  platformUrl: '',
  unitId: '',
  dueDate: '',
  points: 100,
};

export function LaboratoriesManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    // Load laboratories from localStorage
    const storedLabs = loadFromStorage();
    setLaboratories(storedLabs);

    // Load units from localStorage (populated by CoursesManagement)
    try {
      const storedUnits = localStorage.getItem('instructor_units');
      if (storedUnits) {
        const parsed = JSON.parse(storedUnits);
        setUnits(Array.isArray(parsed) ? parsed.map((u: any) => ({ id: u.id, title: u.title })) : []);
      }
    } catch {
      setUnits([]);
    }
    setLoading(false);
  };

  const handleOpenCreate = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setFormError('');
    setShowCreateForm(true);
  };

  const handleOpenEdit = (lab: Laboratory) => {
    setFormData({
      title: lab.title,
      description: lab.description,
      platform: lab.platform,
      platformUrl: lab.platformUrl,
      unitId: lab.unitId,
      dueDate: lab.dueDate,
      points: lab.points ?? 100,
    });
    setEditingId(lab.id);
    setFormError('');
    setShowCreateForm(true);
  };

  const handleCloseForm = () => {
    setShowCreateForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
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

    if (editingId) {
      // Update existing
      const updated = laboratories.map(lab =>
        lab.id === editingId
          ? {
              ...lab,
              title: formData.title.trim(),
              description: formData.description.trim(),
              platform: formData.platform,
              platformUrl: formData.platformUrl.trim(),
              unitId: formData.unitId,
              unitName: selectedUnit?.title ?? '',
              dueDate: formData.dueDate,
              points: formData.points,
            }
          : lab
      );
      setLaboratories(updated);
      saveToStorage(updated);
    } else {
      // Create new
      const newLab: Laboratory = {
        id: crypto.randomUUID(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        platform: formData.platform,
        platformUrl: formData.platformUrl.trim(),
        unitId: formData.unitId,
        unitName: selectedUnit?.title ?? '',
        dueDate: formData.dueDate,
        points: formData.points,
        createdAt: new Date().toISOString(),
      };
      const updated = [newLab, ...laboratories];
      setLaboratories(updated);
      saveToStorage(updated);
    }

    handleCloseForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this laboratory? This cannot be undone.')) return;
    const updated = laboratories.filter(l => l.id !== id);
    setLaboratories(updated);
    saveToStorage(updated);
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
            onClick={loadData}
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

      {/* Create / Edit Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <Beaker className="w-4 h-4 text-violet-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {editingId ? 'Edit Laboratory' : 'Create Laboratory'}
                </h2>
              </div>
              <button
                onClick={handleCloseForm}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{formError}</p>
                </div>
              )}

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
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="Instructions or objectives for this laboratory..."
                  rows={3}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 text-sm resize-none"
                />
              </div>

              {/* Platform */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Platform / Tool <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.platform}
                  onChange={e => {
                    const platform = e.target.value;
                    const autoUrl = PLATFORM_URLS[platform] ?? '';
                    setFormData(f => ({
                      ...f,
                      platform,
                      // Auto-fill URL if the current URL is empty or was a previous auto-fill
                      platformUrl:
                        !f.platformUrl || Object.values(PLATFORM_URLS).includes(f.platformUrl)
                          ? autoUrl
                          : f.platformUrl,
                    }));
                  }}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm"
                >
                  {PLATFORM_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Platform URL */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Platform Link <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="url"
                    value={formData.platformUrl}
                    onChange={e => setFormData(f => ({ ...f, platformUrl: e.target.value }))}
                    placeholder="https://www.canva.com/..."
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <p className="text-slate-500 text-xs mt-1">
                  Paste the link to the platform or specific activity template
                </p>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                  Link to Unit
                </label>
                <select
                  value={formData.unitId}
                  onChange={e => setFormData(f => ({ ...f, unitId: e.target.value }))}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm"
                >
                  <option value="">— No unit —</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.title}</option>
                  ))}
                </select>
              </div>

              {/* Due Date + Points row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={formData.points}
                    onChange={e => setFormData(f => ({ ...f, points: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm"
                  />
                  <p className="text-slate-500 text-xs mt-1">Max score students can earn</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseForm}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {editingId ? 'Save Changes' : 'Create Laboratory'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-slate-500 text-sm">Loading laboratories...</p>
        </div>
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
          {laboratories.map(lab => {
            const isExpanded = expandedId === lab.id;
            const daysLabel = getDaysLabel(lab.dueDate);

            return (
              <div
                key={lab.id}
                className="bg-gradient-to-r from-slate-900/60 to-slate-900/30 border border-slate-800 rounded-xl overflow-hidden"
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
                      onClick={() => handleDelete(lab.id)}
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
    </div>
  );
}
