import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Save, User as UserIcon, Image as ImageIcon, Upload, RotateCcw, Archive, ArrowRight } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { authFetch } from '@/lib/authFetch';
import { getUserDesigns } from '@/components/laboratories/CanvaDesignStudio';

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

export function StudentSettings() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const initialAvatar = user?.avatar_url ?? '';

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [updatingSemester, setUpdatingSemester] = useState(false);
  const [newSemester, setNewSemester] = useState<1 | 2 | 3>(user?.year_level as 1 | 2 | 3 ?? 1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Archive states
  const [archivedUnits, setArchivedUnits] = useState<Unit[]>([]);
  const [archivedLessons, setArchivedLessons] = useState<Lesson[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [archivedQuizResults, setArchivedQuizResults] = useState<any[]>([]);
  const [portfolioCount, setPortfolioCount] = useState(0);

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

  useEffect(() => {
    setFullName(user?.full_name ?? '');
    setAvatarUrl(user?.avatar_url ?? '');
    setNewSemester(user?.year_level as 1 | 2 | 3 ?? 1);
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
      `Are you sure you want to change your semester to ${semesterLabel}? ` +
      'Your previous semester content will be archived and moved to the Archives section.'
    );
    
    if (!confirmUpdate) return;
    
    setUpdatingSemester(true);
    console.log(`🔄 [SEMESTER UPDATE] Starting semester change from ${user?.year_level} to ${newSemester}`);
    try {
      console.log(`📝 [SEMESTER UPDATE] Sending request to update profile...`);
      console.log(`📝 [SEMESTER UPDATE] User ID:`, user?.id);
      console.log(`📝 [SEMESTER UPDATE] Request body:`, { year_level: newSemester });
      
      const res: any = await api.updateProfile({
        year_level: newSemester,
      });
      
      console.log(`📝 [SEMESTER UPDATE] Full response received:`, res);
      console.log(`📝 [SEMESTER UPDATE] Response success:`, res?.success);
      console.log(`📝 [SEMESTER UPDATE] Response data:`, res?.data);
      console.log(`📝 [SEMESTER UPDATE] Response error:`, res?.error);
      
      if (!res?.success) {
        const errorMsg = res?.error?.message || res?.message || 'Failed to update semester (no error message)';
        console.error(`❌ [SEMESTER UPDATE] API returned success=false with error:`, errorMsg);
        throw new Error(errorMsg);
      }
      
      const updated = res.data;
      if (!updated) {
        console.error(`❌ [SEMESTER UPDATE] No user data in response`);
        throw new Error('No user data returned from API');
      }
      
      console.log(`✅ [SEMESTER UPDATE] User data received:`, updated);
      console.log(`✅ [SEMESTER UPDATE] New year_level:`, updated.year_level);
      
      // Update auth store with new user data IMMEDIATELY
      const updatedUser = { ...(user as any), ...updated };
      setUser(updatedUser);
      console.log(`✅ [SEMESTER UPDATE] Auth store updated with new user data`);
      
      toast.success(`✅ Semester updated to ${semesterLabel}! Previous content has been archived.`);
      console.log(`✅ [SEMESTER UPDATE] Toast shown, loading archives...`);
      
      // Reload archives
      await loadArchives();
      
      // Hard refresh page after 1 second to ensure all cached data is cleared
      setTimeout(() => {
        console.log(`🔄 [SEMESTER UPDATE] Hard refresh of page...`);
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      console.error(`❌ [SEMESTER UPDATE] Error caught:`, err);
      console.error(`❌ [SEMESTER UPDATE] Error message:`, err?.message);
      console.error(`❌ [SEMESTER UPDATE] Full error object:`, err);
      toast.error(err?.message || 'Failed to update semester.');
      setUpdatingSemester(false);
    }
  };

  const loadArchives = async () => {
    setLoadingArchives(true);
    try {
      const [response, quizResponse] = await Promise.all([
        authFetch('/units', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        authFetch('/assessments/archived-results'),
      ]);
      const quizData = await quizResponse.json();
      setArchivedQuizResults(quizData?.success ? quizData.data || [] : []);
      setPortfolioCount(getUserDesigns().length);
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

  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Student';

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
            Update Academic Semester
          </h2>
        </div>
        <p className="text-slate-300 text-sm mb-4">
          Change your current semester. Your previous semester content will be automatically archived.
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

      {/* Archives Section */}
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
                {portfolioCount + archivedQuizResults.length} item{portfolioCount + archivedQuizResults.length !== 1 ? 's' : ''}
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
            
            {!loadingArchives && portfolioCount === 0 && archivedQuizResults.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-400">No portfolio designs or archived quiz results yet</p>
              </div>
            )}

            {!loadingArchives && portfolioCount > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-amber-300 mb-3">Portfolio</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg">
                    <p className="text-white text-sm font-medium">{portfolioCount} saved design{portfolioCount !== 1 ? 's' : ''}</p>
                    <button onClick={() => navigate('/portfolio')} className="text-xs text-emerald-400">View portfolio</button>
                  </div>
                </div>
              </div>
            )}

            {!loadingArchives && archivedQuizResults.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-300 mb-3">Archived Quiz Results</h3>
                <div className="space-y-2">
                  {archivedQuizResults.map((result) => (
                    <div key={result.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg">
                      <p className="text-white text-sm">{result.assessment?.title || 'Archived quiz'}</p>
                      <span className="text-xs text-slate-300">Score: {result.score ?? 'Not graded'}</span>
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
          {/* Avatar */}
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
              {fullName || 'Unnamed student'}
            </div>
            <div className="text-slate-400 text-sm truncate">{user?.email}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs font-medium text-violet-200">
                {roleLabel}
              </span>
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

        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={user?.email ?? ''}
            disabled
            className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-slate-400 text-sm cursor-not-allowed"
          />
        </div>

        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Full name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
          />
        </div>

        {/* Avatar uploader */}
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

        {/* Save */}
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

export default StudentSettings;
