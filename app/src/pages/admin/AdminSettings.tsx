import { useState } from 'react';
import { Image as ImageIcon, Save, User as UserIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AetherSpinner } from '@/components/AetherSpinner';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { toast } from 'sonner';

export function AdminSettings() {
  const { user, setUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saveProfile = async () => {
    if (!fullName.trim() || saving) return;
    setSaving(true);
    try {
      const response: any = await api.updateProfile({ full_name: fullName.trim(), avatar_url: avatarUrl.trim() });
      if (!response?.success) throw new Error(response?.error?.message || 'Failed to save profile');
      setUser({ ...(user as any), ...(response.data ?? {}), full_name: fullName.trim(), avatar_url: avatarUrl.trim() });
      toast.success('Profile updated.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      toast.error('Choose an image file no larger than 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const response: any = await api.uploadAvatar(file);
      const nextUrl = response?.data?.avatar_url;
      if (!nextUrl) throw new Error('Upload returned no URL');
      setAvatarUrl(nextUrl);
      setUser({ ...(user as any), ...(response?.data?.user ?? {}), avatar_url: nextUrl });
      toast.success('Avatar uploaded.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload avatar.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-violet-500/15 flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-violet-300" />
        </div>
        <div>
          <h1 className="text-white text-xl font-semibold">Settings</h1>
          <p className="text-slate-400 text-sm">Manage your administrator profile.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-violet-300" />
          <h2 className="text-white text-sm font-semibold uppercase tracking-wide">Profile</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-violet-500/20 flex items-center justify-center text-white text-2xl font-semibold">
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : user?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <label className="inline-flex items-center gap-2 w-fit px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer text-sm">
            <Upload className="w-4 h-4" />
            {uploading ? <AetherSpinner className="w-4 h-4" /> : 'Upload avatar'}
            <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} className="hidden" />
          </label>
        </div>
        <div>
          <label htmlFor="admin-full-name" className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
          <input id="admin-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-white outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
          <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-slate-400">{user?.email}</p>
        </div>
        <Button onClick={saveProfile} disabled={saving || !fullName.trim()} className="bg-violet-600 hover:bg-violet-700 text-white">
          {saving ? <AetherSpinner className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save profile
        </Button>
      </div>
    </div>
  );
}
