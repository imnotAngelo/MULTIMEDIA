import { useEffect, useMemo, useState } from 'react';
import { FileText, FlaskConical, Megaphone, RefreshCw, Send, Tag } from 'lucide-react';
import { AetherSpinner } from './AetherSpinner';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';

interface Unit { id: string; title: string; }
interface Lesson { id: string; title: string; }
interface Announcement {
  id: string;
  title: string;
  message: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  context_type?: 'lesson' | 'laboratory' | null;
  context_name?: string | null;
  created_at: string;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function AnnouncementGroup({ canPost = false }: { canPost?: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [contextType, setContextType] = useState<'lesson' | 'laboratory'>('lesson');
  const [unitId, setUnitId] = useState('');
  const [contextId, setContextId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadFeed = async () => {
    try {
      const response = await authFetch('/notifications/announcements');
      if (!response.ok) throw new Error('Unable to load announcements');
      setItems(await response.json());
    } catch (err: any) {
      setError(err?.message || 'Unable to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    if (!canPost) return;
    authFetch('/units')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setUnits(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {});
  }, [canPost]);

  useEffect(() => {
    if (!canPost || contextType !== 'lesson' || !unitId) {
      setLessons([]);
      return;
    }
    authFetch(`/units/${unitId}/lessons`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setLessons(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setLessons([]));
  }, [canPost, contextType, unitId]);

  const contextOptions = useMemo(() => {
    if (contextType === 'laboratory') {
      return units.map((unit) => ({ id: unit.id, name: `${unit.title} Laboratory` }));
    }
    return lessons;
  }, [contextType, lessons, units]);

  const selectedContext = contextOptions.find((option) => option.id === contextId);

  const handlePost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !message.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('message', message.trim());
      if (selectedContext) {
        form.append('contextType', contextType);
        form.append('contextId', selectedContext.id);
        form.append('contextName', selectedContext.name || selectedContext.title);
      }
      const response = await authFetch('/notifications/announcement', { method: 'POST', body: form });
      if (!response.ok) throw new Error(await response.text());
      setTitle('');
      setMessage('');
      setContextId('');
      await loadFeed();
    } catch (err: any) {
      setError(err?.message || 'Unable to send announcement');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="px-6 pt-6 max-w-7xl mx-auto">
      <div className="bg-slate-900/70 border border-amber-500/20 rounded-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Class Announcements</h2>
              <p className="text-slate-400 text-xs">A shared group chat for instructor updates</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={loadFeed} className="text-slate-400 hover:text-white" title="Refresh announcements">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </header>

        {canPost && (
          <form onSubmit={handlePost} className="p-5 border-b border-slate-800 space-y-3">
            <div className="grid md:grid-cols-[1fr_180px_1fr] gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" maxLength={120} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />
              <select value={contextType} onChange={(e) => { setContextType(e.target.value as 'lesson' | 'laboratory'); setContextId(''); }} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                <option value="lesson">Tag a lesson</option>
                <option value="laboratory">Tag a laboratory</option>
              </select>
              {contextType === 'laboratory' ? <select value={contextId} onChange={(e) => setContextId(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"><option value="">No laboratory tag</option>{contextOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select> : <select value={unitId} onChange={(e) => { setUnitId(e.target.value); setContextId(''); }} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"><option value="">Choose a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select>}
            </div>
            {contextType === 'lesson' && unitId && (
              <select value={contextId && lessons.some((lesson) => lesson.id === contextId) ? contextId : ''} onChange={(e) => setContextId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                <option value="">Choose a lesson to tag</option>
                {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
              </select>
            )}
            <div className="flex gap-3 items-end">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write an update for every student..." maxLength={1000} rows={2} className="flex-1 resize-none bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />
              <Button type="submit" disabled={sending || !title.trim() || !message.trim()} className="bg-amber-500 hover:bg-amber-600 text-slate-950"><Send className="w-4 h-4 mr-2" />Post</Button>
            </div>
          </form>
        )}

        <div className="max-h-[360px] overflow-y-auto p-5 space-y-3">
          {loading ? <div className="text-slate-400 text-sm flex items-center gap-2"><AetherSpinner className="w-4 h-4" /> Loading announcements...</div> : items.length === 0 ? <p className="text-slate-400 text-sm">No announcements yet.</p> : items.map((item) => (
            <article key={item.id} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-white font-medium">{item.title}</h3><p className="text-slate-300 text-sm whitespace-pre-wrap mt-1">{item.message}</p></div>
                <span className="text-xs text-slate-500 whitespace-nowrap">{formatTime(item.created_at)}</span>
              </div>
              {item.context_name && <div className="inline-flex items-center gap-1.5 mt-3 px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 text-xs"><Tag className="w-3 h-3" />{item.context_type === 'laboratory' ? <FlaskConical className="w-3 h-3" /> : <FileText className="w-3 h-3" />}{item.context_name}</div>}
              {item.attachment_url && <a href={resolveBackendAssetUrl(item.attachment_url)} target="_blank" rel="noreferrer" className="block text-xs text-amber-300 mt-2">{item.attachment_name || 'Open attachment'}</a>}
            </article>
          ))}
          {error && <p className="text-rose-300 text-sm">{error}</p>}
        </div>
      </div>
    </section>
  );
}
