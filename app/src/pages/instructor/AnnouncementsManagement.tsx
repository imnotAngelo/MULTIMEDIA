import { useEffect, useRef, useState } from 'react';
import { Megaphone, Send, Trash2, Loader2, Clock, Paperclip, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationService } from '@/services/notificationService';
import { authFetch } from '@/lib/authFetch';
import { useAuthStore } from '@/stores/authStore';

interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

const STORAGE_KEY = 'instructor_announcements';

const loadAnnouncements = (): Announcement[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveAnnouncements = (items: Announcement[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export function AnnouncementsManagement() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAnnouncements(loadAnnouncements());
  }, []);

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

  const handlePost = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    if (!message.trim()) {
      setError('Please enter the announcement message.');
      return;
    }

    setSending(true);
    try {
      // Build multipart form for file + text fields
      const fd = new FormData();
      fd.append('title', `📢 ${title.trim()}`);
      fd.append('message', message.trim());
      if (file) fd.append('file', file);

      const res = await authFetch('/notifications/announcement', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `Server error (${res.status})`);
      }
      const data = await res.json();

      // Toast for the instructor + add to their own bell list
      notificationService.notifyAnnouncement(`${title.trim()} — ${message.trim()}`);

      const newItem: Announcement = {
        id: crypto.randomUUID(),
        title: title.trim(),
        message: message.trim(),
        createdAt: new Date().toISOString(),
        attachmentUrl: data?.attachmentUrl ?? null,
        attachmentName: data?.attachmentName ?? null,
      };
      const next = [newItem, ...announcements];
      setAnnouncements(next);
      saveAnnouncements(next);

      setTitle('');
      setMessage('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err?.message ?? 'Failed to post announcement.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this announcement from your history? Students who already received it will keep theirs.')) return;
    const next = announcements.filter((a) => a.id !== id);
    setAnnouncements(next);
    saveAnnouncements(next);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Megaphone className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Special Announcements</h1>
          <p className="text-sm text-slate-400">
            Post important announcements that will be sent to every student instantly.
          </p>
        </div>
      </div>

      {/* Compose Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Compose Announcement</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Class Cancelled Tomorrow"
            maxLength={120}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your announcement here..."
            rows={5}
            maxLength={1000}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
          <p className="text-xs text-slate-500 text-right">{message.length}/1000</p>
        </div>

        {/* Attachment */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Attachment (optional)</label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > 50 * 1024 * 1024) {
                setError('File too large. Max 50 MB.');
                return;
              }
              setError(null);
              setFile(f);
            }}
            className="hidden"
            id="announcement-file-input"
          />
          {!file ? (
            <label
              htmlFor="announcement-file-input"
              className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:border-amber-500 hover:text-amber-400 cursor-pointer transition-colors w-fit"
            >
              <Paperclip className="w-4 h-4" />
              <span className="text-sm">Attach a file (PDF, image, doc, etc.)</span>
            </label>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg w-fit">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-slate-200 truncate max-w-xs">{file.name}</span>
              <span className="text-xs text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
              <button
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-slate-400 hover:text-red-400 ml-1"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-slate-500">
            Sending as <span className="text-slate-300 font-medium">{user?.full_name ?? user?.email ?? 'Instructor'}</span>
          </p>
          <Button
            onClick={handlePost}
            disabled={sending}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send to All Students
              </>
            )}
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          Recent Announcements
        </h2>

        {announcements.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-xl p-10 text-center">
            <Megaphone className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">You haven't posted any announcements yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">📢</span>
                      <h3 className="text-base font-semibold text-white truncate">{a.title}</h3>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{a.message}</p>
                    {a.attachmentUrl && (
                      <a
                        href={a.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        {a.attachmentName ?? 'Download attachment'}
                      </a>
                    )}
                    <p className="text-xs text-slate-500 mt-2">{formatDate(a.createdAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(a.id)}
                    className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
