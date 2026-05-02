import { useEffect, useRef, useState } from 'react';
import { GraduationCap, Save, Loader2, User as UserIcon, Trophy, Calendar, Image as ImageIcon, BookOpen, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';

const YEAR_LABELS: Record<number, string> = {
  1: '1st Year',
  2: '2nd Year',
  3: '3rd Year',
  4: '4th Year',
};

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

function arraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function InstructorSettings() {
  const { user, setUser } = useAuthStore();
  const initialYears = (user?.teaching_year_levels ?? []) as (1 | 2 | 3 | 4)[];
  const initialAvatar = user?.avatar_url ?? '';

  const [teachingYears, setTeachingYears] = useState<(1 | 2 | 3 | 4)[]>(initialYears);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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

  useEffect(() => {
    setTeachingYears((user?.teaching_year_levels ?? []) as (1 | 2 | 3 | 4)[]);
    setFullName(user?.full_name ?? '');
    setAvatarUrl(user?.avatar_url ?? '');
  }, [user]);

  const dirty =
    !arraysEqual(teachingYears, initialYears) ||
    fullName.trim() !== (user?.full_name ?? '').trim() ||
    avatarUrl.trim() !== (user?.avatar_url ?? '').trim();

  const toggleYear = (y: 1 | 2 | 3 | 4) => {
    setTeachingYears((prev) =>
      prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y].sort((a, b) => a - b) as (1 | 2 | 3 | 4)[]
    );
  };

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
        teaching_year_levels: teachingYears,
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
            Manage your profile, avatar, and the year levels you teach.
          </p>
        </div>
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
              {teachingYears.length > 0 ? (
                teachingYears.map((y) => (
                  <span
                    key={y}
                    className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 px-2.5 py-0.5 text-xs font-medium text-fuchsia-200"
                  >
                    Teaches {YEAR_LABELS[y]}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/40 border border-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                  Teaching years not set
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-white/5">
          <div className="rounded-xl bg-slate-800/40 border border-white/5 p-3">
            <div className="flex items-center gap-1.5 text-amber-300 text-xs font-medium mb-1">
              <Trophy className="w-3.5 h-3.5" />
              Total XP
            </div>
            <div className="text-white text-lg font-semibold">
              {user?.xp_total ?? 0}
            </div>
          </div>
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
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

        {/* Teaching year levels (multi-select) */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-violet-300" />
            <label className="block text-sm font-medium text-slate-300">
              Year levels you teach
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((y) => {
              const selected = teachingYears.includes(y as 1 | 2 | 3 | 4);
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => toggleYear(y as 1 | 2 | 3 | 4)}
                  className={
                    'rounded-lg border px-3 py-3 text-sm font-medium transition ' +
                    (selected
                      ? 'border-violet-500/60 bg-violet-500/15 text-white shadow shadow-violet-500/20'
                      : 'border-white/10 bg-slate-800/40 text-slate-300 hover:border-white/20 hover:bg-slate-800/70')
                  }
                  aria-pressed={selected}
                >
                  {YEAR_LABELS[y]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Select one or more year levels you currently teach. You can change these
            anytime as your assignments change.
          </p>
        </div>

        <div className="flex justify-end pt-2 border-t border-white/5">
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
