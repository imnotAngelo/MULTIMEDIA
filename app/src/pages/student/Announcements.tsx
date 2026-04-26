import { useEffect, useState } from 'react';
import { Megaphone, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { useNotificationStore } from '@/stores/notificationStore';

interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  attachment_url?: string | null;
  attachment_name?: string | null;
}

export function Announcements() {
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setFromApi = useNotificationStore((s) => s.setFromApi);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/notifications');
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const rows = await res.json();
      // Sync with the bell-icon store too
      setFromApi(rows);
      // Filter to announcements only and keep newest first
      const onlyAnnouncements = (rows as AnnouncementRow[])
        .filter((r) => r.type === 'announcement' as any || true)
        .filter((r: any) => r.type === 'announcement');
      setItems(onlyAnnouncements);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await authFetch('/notifications/read-all', { method: 'PATCH' });
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    } catch {
      // Silent
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Announcements</h1>
            <p className="text-sm text-slate-400">
              Important messages from your instructor
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                  {unreadCount} unread
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Mark all read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnnouncements}
            disabled={loading}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No announcements yet</h3>
          <p className="text-sm text-slate-500">
            Your instructor hasn't posted any announcements. Check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div
              key={a.id}
              className={`bg-slate-900/60 border rounded-xl p-5 transition-colors ${
                !a.read
                  ? 'border-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.1)]'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">📢</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-semibold text-white leading-tight">
                      {a.title.replace(/^📢\s*/, '')}
                    </h3>
                    {!a.read && (
                      <span className="shrink-0 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {a.message}
                  </p>
                  {a.attachment_url && (
                    <a
                      href={a.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      {a.attachment_name ?? 'Download attachment'}
                    </a>
                  )}
                  <p className="text-xs text-slate-500 mt-3">{formatDate(a.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
