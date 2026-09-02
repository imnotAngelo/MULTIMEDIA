import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Save, User as UserIcon, Calendar, Image as ImageIcon, Upload, RotateCcw, Archive, ArrowRight, Plus, X } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { authFetch } from '@/lib/authFetch';

const ACADEMIC_YEAR_OPTIONS = [
  { value: 1, label: '1st Sem' },
  { value: 2, label: '2nd Sem' },
  { value: 3, label: 'Summer' },
];

interface Unit {
  id: string;
  title: string;
  description: string;
}

interface Lesson {
  id: string;
  title: string;
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '').concat(parts[1]?.[0] ?? '').toUpperCase() || '?';
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function InstructorSettings() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const initialAvatar = user?.avatar_url ?? '';

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [updatingSemester, setUpdatingSemester] = useState(false);
  const [newSemester, setNewSemester] = useState<1 | 2 | 3>(user?.year_level as 1 | 2 | 3 ?? 1);
  const [teachingSections, setTeachingSections] = useState<string[]>(user?.teaching_sections ?? []);
  const [newSection, setNewSection] = useState('');
  const [addingSectionId, setAddingSectionId] = useState<string | null>(null);
  const [archivedUnits, setArchivedUnits] = useState<Unit[]>([]);
  const [archivedLessons, setArchivedLessons] = useState<Lesson[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large (max 5 MB).');
      return;
    }
    setUploadingAvatar(true);
    try {
      const res: any = await api.uploadAvatar(file);
      const newUrl: string = res?.data?.avatar_url ?? '';
      const updatedUser = res?.data?.user;
      if (!newUrl) throw new Error('Upload returned no URL');
      setAvatarUrl(newUrl);
      setUser({ ...(user as any), ...(updatedUser ?? { avatar_url: newUrl }) });
      toast.success('Avatar uploaded.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAddSection = async () => {
    if (!newSection.trim()) {
      toast.error('Section name cannot be empty.');
      return;
    }
    if (teachingSections.includes(newSection.trim())) {
      toast.error('This section already exists.');
      return;
    }
    setAddingSectionId('adding');
    try {
      const updatedSections = [...teachingSections, newSection.trim()];
      const res: any = await api.updateProfile({
        teaching_sections: updatedSections,
      } as any);
      if (!res?.success) {
        throw new Error(res?.error?.message || 'Failed to add section');
      }
      setTeachingSections(updatedSections);
      setUser({ ...(user as any), teaching_sections: updatedSections });
      setNewSection('');
      toast.success('Section added successfully.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add section.');
    } finally {
      setAddingSectionId(null);
    }
  };

  const handleRemoveSection = async (section: string) => {
    setAddingSectionId(`removing-${section}`);
    try {
      const updatedSections = teachingSections.filter(s => s !== section);
      const res: any = await api.updateProfile({
        teaching_sections: updatedSections,
      } as any);
      if (!res?.success) {
        throw new Error(res?.error?.message || 'Failed to remove section');
      }
      setTeachingSections(updatedSections);
      setUser({ ...(user as any), teaching_sections: updatedSections });
      toast.success('Section removed successfully.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove section.');
    } finally {
      setAddingSectionId(null);
    }
  };

  const loadArchives = async () => {
    setLoadingArchives(true);
    try {
      const response = await authFetch('http://localhost:3001/api/units', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      console.log('📦 [ARCHIVES] API Response:', data);
      if (data?.success) {
        const archived = data.archived || [];
        console.log('📦 [ARCHIVES] Archived units count:', archived.length);
        setArchivedUnits(archived);
        
        // Fetch archived lessons from archived units
        const allArchivedLessons: Lesson[] = [];
        for (const unit of archived) {
          const lessonRes = await authFetch(`http://localhost:3001/api/units/${unit.id}/lessons`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          const lessonData = await lessonRes.json();
          console.log(`📖 [ARCHIVES] Lessons for unit ${unit.id}:`, lessonData);
          if (lessonData?.data?.archived) {
            allArchivedLessons.push(...lessonData.data.archived);
          }
        }
        console.log('📖 [ARCHIVES] Total archived lessons:', allArchivedLessons.length);
        setArchivedLessons(allArchivedLessons);
      }
    } catch (err) {
      console.error('Failed to load archives:', err);
    } finally {
      setLoadingArchives(false);
    }
  };

  const handleUnarchiveUnit = async (unitId: string) => {
    setRestoringId(unitId);
    try {
      const response = await authFetch(`http://localhost:3001/api/units/${unitId}/unarchive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      
      const lessonCount = data.data?.restoredLessonCount || 0;
      if (lessonCount > 0) {
        toast.success(`✅ Unit restored with ${lessonCount} lesson${lessonCount !== 1 ? 's' : ''} and all videos`);
      } else {
        toast.success('✅ Unit restored successfully');
      }
      await loadArchives();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore unit');
    } finally {
      setRestoringId(null);
    }
  };

  const handleUnarchiveLesson = async (lessonId: string) => {
    setRestoringId(lessonId);
    try {
      const response = await authFetch(`http://localhost:3001/api/units/lessons/${lessonId}/unarchive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      
      const hasVideo = data.data?.video_url ? ' with video' : '';
      toast.success(`✅ Lesson restored successfully${hasVideo}`);
      await loadArchives();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore lesson');
    } finally {
      setRestoringId(null);
    }
  };

  useEffect(() => {
    setFullName(user?.full_name ?? '');
    setAvatarUrl(user?.avatar_url ?? '');
    setNewSemester(user?.year_level as 1 | 2 | 3 ?? 1);
    setTeachingSections(user?.teaching_sections ?? []);
    // Load archives on component mount so they're available
    loadArchives();
  }, [user]);

  useEffect(() => {
    if (showArchives) {
      loadArchives();
    }
  }, [showArchives]);

  const dirty =
    fullName.trim() !== (user?.full_name ?? '').trim() ||
    avatarUrl.trim() !== (user?.avatar_url ?? '').trim();

  const handleSave = async () => {
    if (!dirty || saving) return;
    if (!fullName.trim()) {
      toast.error('Full name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const res: any = await api.updateProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim(),
      });
      if (!res?.success) {
        throw new Error(res?.error?.message || 'Failed to save settings');
      }
      const updated = res.data;
      setUser({ ...(user as any), ...updated });
      toast.success('Profile updated successfully.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSemester = async () => {
    if (newSemester === user?.year_level || updatingSemester) return;
    
    const semesterLabel = ACADEMIC_YEAR_OPTIONS.find(o => o.value === newSemester)?.label;
    const confirmUpdate = window.confirm(
      `Are you sure you want to change to ${semesterLabel}?\n\n` +
      `This will:\n` +
      `✓ Update your teaching semester\n` +
      `✓ Clear all student progress & submissions\n` +
      `✓ Archive your previous semester's content\n\n` +
      `This action cannot be undone.`
    );
    
    if (!confirmUpdate) return;
    
    setUpdatingSemester(true);
    console.log(`🔄 [SEMESTER UPDATE] Starting semester change from ${user?.year_level} to ${newSemester}`);
    try {
      console.log(`📝 [SEMESTER UPDATE] Calling /api/users/update-semester...`);
      
      const response = await authFetch('/users/update-semester', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teaching_year_levels: [newSemester],
          teaching_sections: teachingSections.length > 0 ? teachingSections : null,
        }),
      });
      
      const data = await response.json();
      console.log(`📝 [SEMESTER UPDATE] API Response:`, data);
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update semester');
      }
      
      // Update user's year_level in auth store
      const updatedUser = { ...(user as any), year_level: newSemester };
      setUser(updatedUser);
      setNewSemester(newSemester);
      
      // Show success with details of what was cleared
      const cleared = data.data?.cleared || {};
      const progressCount = cleared.lesson_progress || 0;
      const labCount = cleared.lab_submissions || 0;
      const quizCount = cleared.assessment_submissions || 0;
      
      const clearDetails = [
        progressCount > 0 ? `${progressCount} lesson progress` : null,
        labCount > 0 ? `${labCount} lab submissions` : null,
        quizCount > 0 ? `${quizCount} quiz submissions` : null,
      ].filter(Boolean).join(', ') || 'all student data';
      
      toast.success(
        `✅ Semester updated to ${semesterLabel}!\n🗑️ Cleared: ${clearDetails}\n📦 Previous content archived.`
      );
      
      console.log(`✅ [SEMESTER UPDATE] Semester update complete`);
    } catch (err: any) {
      console.error(`❌ [SEMESTER UPDATE] Error:`, err);
      toast.error(err?.message || 'Failed to update semester.');
      setUpdatingSemester(false);
    } finally {
      if (updatingSemester) {
        setUpdatingSemester(false);
      }
    }
  };

  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Instructor';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/15">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white text-xl font-semibold leading-tight">Settings</h1>
          <p className="text-slate-400 text-sm">
            Manage your profile and avatar.
          </p>
        </div>
      </div>

      {/* Semester Update Card */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw className="w-4 h-4 text-amber-300" />
          <h2 className="text-white text-sm font-semibold tracking-wide uppercase">
            Update Teaching Semester
          </h2>
        </div>
        <p className="text-slate-300 text-sm mb-4">
          Change your current teaching semester. Your previous semester content will be automatically archived.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Current Semester
            </label>
            <select
              value={newSemester}
              onChange={(e) => setNewSemester(Number(e.target.value) as 1 | 2 | 3)}
              className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
            >
              {ACADEMIC_YEAR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleUpdateSemester}
            disabled={newSemester === user?.year_level || updatingSemester}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
          >
            {updatingSemester ? (
              <>
                <AetherSpinner className="w-4 h-4 mr-2" />
                Updating...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Update Semester
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Teaching Sections Card */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-blue-300" />
          <h2 className="text-white text-sm font-semibold tracking-wide uppercase">
            Manage Teaching Sections
          </h2>
        </div>
        <p className="text-slate-300 text-sm mb-4">
          Add or manage the sections/classes you teach.
        </p>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
              placeholder="e.g., Class A, Section 1, Period 3..."
              className="flex-1 rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40"
            />
            <Button
              onClick={handleAddSection}
              disabled={addingSectionId === 'adding' || !newSection.trim()}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white whitespace-nowrap"
            >
              {addingSectionId === 'adding' ? (
                <>
                  <AetherSpinner className="w-4 h-4 mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </>
              )}
            </Button>
          </div>

          {teachingSections.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Current sections:</p>
              <div className="flex flex-wrap gap-2">
                {teachingSections.map((section) => (
                  <div
                    key={section}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-1.5"
                  >
                    <span className="text-sm text-blue-200">{section}</span>
                    <button
                      onClick={() => handleRemoveSection(section)}
                      disabled={addingSectionId === `removing-${section}`}
                      className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingSectionId === `removing-${section}` ? (
                        <AetherSpinner className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Archives Section - Always visible */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 mb-6">
        <div
          className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowArchives(!showArchives)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Archive className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Archives</h2>
              <p className="text-xs text-amber-400">
                {archivedUnits.length + archivedLessons.length} item{archivedUnits.length + archivedLessons.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <ArrowRight className={`w-4 h-4 text-slate-600 transform transition-transform ${showArchives ? 'rotate-90' : ''}`} />
        </div>

        {showArchives && (
          <div className="mt-4">
            {loadingArchives && (
              <div className="flex justify-center py-8">
                <AetherSpinner className="w-6 h-6" />
              </div>
            )}
            
            {!loadingArchives && archivedUnits.length === 0 && archivedLessons.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-400">No archived content yet</p>
              </div>
            )}

            {!loadingArchives && archivedUnits.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-amber-300 mb-3">Archived Units</h3>
                <div className="space-y-2">
                  {archivedUnits.map((unit) => (
                    <div key={unit.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg">
                      <div>
                        <p className="text-white text-sm font-medium">{unit.title}</p>
                      </div>
                      <button
                        onClick={() => handleUnarchiveUnit(unit.id)}
                        disabled={restoringId === unit.id}
                        className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded"
                      >
                        <RotateCcw className={`w-3 h-3 ${restoringId === unit.id ? 'animate-spin' : ''}`} />
                        {restoringId === unit.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loadingArchives && archivedLessons.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-300 mb-3">Archived Lessons</h3>
                <div className="space-y-2">
                  {archivedLessons.slice(0, 5).map((lesson) => (
                    <div key={lesson.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg">
                      <p className="text-white text-sm">{lesson.title}</p>
                      <button
                        onClick={() => handleUnarchiveLesson(lesson.id)}
                        disabled={restoringId === lesson.id}
                        className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded"
                      >
                        <RotateCcw className={`w-3 h-3 ${restoringId === lesson.id ? 'animate-spin' : ''}`} />
                        {restoringId === lesson.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <UserIcon className="w-4 h-4 text-violet-300" />
          <h2 className="text-white text-sm font-semibold tracking-wide uppercase">
            Profile
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || 'avatar'}
                className="w-20 h-20 rounded-2xl object-cover border border-white/10 bg-slate-800"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-2xl font-semibold shadow-lg shadow-violet-500/20">
                {getInitials(fullName)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-white text-lg font-semibold truncate">
              {fullName || 'Unnamed instructor'}
            </div>
            <div className="text-slate-400 text-sm truncate">{user?.email}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs font-medium text-violet-200">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 mt-5 pt-5 border-t border-white/5">
          <div className="rounded-xl bg-slate-800/40 border border-white/5 p-3">
            <div className="flex items-center gap-1.5 text-sky-300 text-xs font-medium mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Member since
            </div>
            <div className="text-white text-sm font-semibold">
              {formatDate(user?.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-violet-300" />
          <h2 className="text-white text-sm font-semibold tracking-wide uppercase">
            Account details
          </h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
          <input
            type="email"
            value={user?.email ?? ''}
            disabled
            className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-slate-400 text-sm cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Profile photo
          </label>
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar preview"
                  className="w-16 h-16 rounded-xl object-cover border border-white/10 bg-slate-800"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xl font-semibold">
                  {getInitials(fullName)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="border-white/15 bg-slate-800/40 hover:bg-slate-800/70 text-slate-200"
              >
                {uploadingAvatar ? (
                  <>
                    <AetherSpinner className="w-4 h-4 mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload photo
                  </>
                )}
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                JPEG, PNG, WEBP, or GIF · up to 5 MB.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-white/5">
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white"
          >
            {saving ? (
              <>
                <AetherSpinner className="w-4 h-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InstructorSettings;
