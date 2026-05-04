import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MessageSquare, Send, Search, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import {
  messageService,
  type Contact,
  type Message,
} from '@/services/messageService';

interface ConversationViewProps {
  /** Header label, e.g. "Message your instructor" or "Student conversations" */
  title: string;
  /** Sub-label */
  subtitle: string;
  /** Empty-state text when there are no contacts to chat with yet. */
  emptyContactsLabel: string;
  /** Polling interval (ms) for active thread refresh. Default 6s. */
  pollMs?: number;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function relativeShort(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function RoleBadge({ role, size = 'sm' }: { role?: string; size?: 'xs' | 'sm' }) {
  const r = (role || '').toLowerCase();
  const isInstructor = r === 'instructor';
  const isStudent = r === 'student';
  if (!isInstructor && !isStudent) return null;
  const label = isInstructor ? 'Instructor' : 'Student';
  const tone = isInstructor
    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  const pad = size === 'xs' ? 'px-1.5 py-[1px] text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center font-medium uppercase tracking-wide rounded-full border ${tone} ${pad}`}>
      {label}
    </span>
  );
}

export function ConversationView({
  title,
  subtitle,
  emptyContactsLabel,
  pollMs = 6000,
}: ConversationViewProps) {
  const { user } = useAuthStore();
  const myId = user?.id ?? '';
  const myRole = user?.role ?? '';
  // A student may only chat with instructors; an instructor may only chat with students.
  // No student-to-student or instructor-to-instructor messaging is permitted.
  const allowedPeerRole: 'instructor' | 'student' | null =
    myRole === 'student' ? 'instructor' : myRole === 'instructor' ? 'student' : null;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listEndRef = useRef<HTMLDivElement | null>(null);

  const loadContacts = useCallback(async () => {
    setContactsError(null);
    try {
      const list = await messageService.listContacts();
      // Defensive client-side filter: enforce student<->instructor only,
      // even if the API ever returns extra rows.
      const safeList = allowedPeerRole
        ? list.filter((c) => c.role === allowedPeerRole)
        : [];
      setContacts(safeList);
      // Auto-select first contact if nothing is selected yet
      setActiveId((curr) => curr ?? safeList[0]?.id ?? null);
    } catch (err: any) {
      const msg =
        typeof err?.message === 'string' && err.message
          ? err.message
          : 'Failed to load contacts';
      setContactsError(msg);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const loadThread = useCallback(
    async (userId: string, opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setThreadLoading(true);
      setThreadError(null);
      try {
        const data = await messageService.getThread(userId);
        setMessages(data);
        // Mark as read in the background; ignore errors here
        messageService.markThreadRead(userId).catch(() => {});
        // Reflect read state locally
        setContacts((prev) =>
          prev.map((c) => (c.id === userId ? { ...c, unread_count: 0 } : c))
        );
      } catch (err: any) {
        if (!opts.silent) {
          const msg =
            typeof err?.message === 'string' && err.message
              ? err.message
              : 'Failed to load conversation';
          setThreadError(msg);
        }
      } finally {
        if (!opts.silent) setThreadLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Load thread when active contact changes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    loadThread(activeId);
  }, [activeId, loadThread]);

  // Poll active thread + contacts list
  useEffect(() => {
    if (pollMs <= 0) return;
    const t = setInterval(() => {
      if (activeId) loadThread(activeId, { silent: true });
      // Cheap-ish refresh of contact list to update unread/last_message
      messageService
        .listContacts()
        .then((list) =>
          setContacts(
            allowedPeerRole ? list.filter((c) => c.role === allowedPeerRole) : []
          )
        )
        .catch(() => {});
    }, pollMs);
    return () => clearInterval(t);
  }, [activeId, loadThread, pollMs]);

  // Auto-scroll on new messages
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeId]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeId) ?? null,
    [contacts, activeId]
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    // Hard guard: refuse to send unless the peer's role is the allowed counterpart.
    const peer = contacts.find((c) => c.id === activeId);
    if (!peer || !allowedPeerRole || peer.role !== allowedPeerRole) {
      setThreadError(
        myRole === 'student'
          ? 'You can only message instructors.'
          : 'You can only message students.'
      );
      return;
    }
    const body = draft.trim();
    setSending(true);
    setDraft('');

    // Optimistic append
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: myId,
      recipient_id: activeId,
      body,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const saved = await messageService.sendMessage(activeId, body);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      // Refresh contacts so last_message updates
      messageService
        .listContacts()
        .then((list) =>
          setContacts(
            allowedPeerRole ? list.filter((c) => c.role === allowedPeerRole) : []
          )
        )
        .catch(() => {});
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      const msg =
        typeof err?.message === 'string' && err.message
          ? err.message
          : 'Failed to send message';
      setThreadError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/15">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-semibold leading-tight">{title}</h1>
            <p className="text-slate-400 text-sm">{subtitle}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            loadContacts();
            if (activeId) loadThread(activeId);
          }}
          className="text-slate-400 hover:text-slate-100"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Contacts column */}
        <aside className="bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contactsLoading ? (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...
              </div>
            ) : contactsError ? (
              <div className="p-4 text-rose-300 text-sm">{contactsError}</div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-4 text-slate-400 text-sm">{emptyContactsLabel}</div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {filteredContacts.map((c) => {
                  const isActive = c.id === activeId;
                  const preview = c.last_message?.body ?? 'No messages yet';
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className={`w-full text-left px-3 py-3 transition-colors ${
                          isActive
                            ? 'bg-violet-500/10 border-l-2 border-violet-500'
                            : 'hover:bg-slate-800/50 border-l-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                            {c.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-white truncate">
                                  {c.full_name}
                                </span>
                                <RoleBadge role={c.role} size="xs" />
                              </div>
                              <span className="text-[11px] text-slate-500 shrink-0">
                                {relativeShort(c.last_message?.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <span className="text-xs text-slate-400 truncate">
                                {preview}
                              </span>
                              {c.unread_count > 0 && (
                                <span className="bg-violet-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                                  {c.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread column */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {!activeContact ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              {contacts.length === 0 ? emptyContactsLabel : 'Select a conversation to start chatting.'}
            </div>
          ) : (
            <>
              <header className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-semibold">
                  {activeContact.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-medium leading-tight">
                      {activeContact.full_name}
                    </p>
                    <RoleBadge role={activeContact.role} />
                  </div>
                  <p className="text-slate-500 text-xs capitalize">{activeContact.role}</p>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {threadLoading ? (
                  <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading messages...
                  </div>
                ) : threadError ? (
                  <div className="text-rose-300 text-sm">{threadError}</div>
                ) : messages.length === 0 ? (
                  <div className="text-slate-400 text-sm text-center mt-8">
                    No messages yet — send the first one below.
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === myId;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-[75%]">
                          <div
                            className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                              mine
                                ? 'bg-violet-500/15 text-violet-50 border border-violet-500/30'
                                : 'bg-slate-800/70 text-slate-100 border border-slate-700'
                            }`}
                          >
                            {m.body}
                          </div>
                          <div
                            className={`text-[11px] text-slate-500 mt-1 px-1 ${
                              mine ? 'text-right' : 'text-left'
                            }`}
                          >
                            {formatTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={listEndRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="p-3 border-t border-slate-800 flex items-end gap-2"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e as any);
                    }
                  }}
                  placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  disabled={sending}
                  className="flex-1 resize-none bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 disabled:opacity-60"
                />
                <Button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-1" />
                  )}
                  Send
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default ConversationView;
