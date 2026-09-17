import { useState } from 'react';
import { Megaphone, MessageSquare } from 'lucide-react';
import { AnnouncementGroup } from './AnnouncementGroup';
import { ConversationView } from './ConversationView';
import { useThemeStore } from '@/stores/themeStore';

interface MessagesWorkspaceProps {
  instructor: boolean;
}

export function MessagesWorkspace({ instructor }: MessagesWorkspaceProps) {
  const [view, setView] = useState<'private' | 'announcements'>('private');
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';

  return (
    <div>
      <div className="px-6 pt-6 max-w-7xl mx-auto">
        <div
          className={`inline-flex rounded-xl p-1 gap-1 border transition-colors ${
            isLight
              ? 'bg-slate-100 border-slate-200 shadow-sm'
              : 'bg-slate-900/70 border-slate-800'
          }`}
        >
          <button
            type="button"
            onClick={() => setView('private')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === 'private'
                ? isLight
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-violet-500 text-white shadow-sm'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Private Messages
          </button>
          <button
            type="button"
            onClick={() => setView('announcements')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === 'announcements'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Class Announcements
          </button>
        </div>
      </div>
      {view === 'announcements' ? (
        <AnnouncementGroup canPost={instructor} />
      ) : instructor ? (
        <ConversationView
          title="Private Messages"
          subtitle="Reply to student inquiries and questions"
          emptyContactsLabel="No students have registered yet."
        />
      ) : (
        <ConversationView
          title="Private Messages"
          subtitle="Send your inquiries and questions to your instructor"
          emptyContactsLabel="No instructors are available yet. Please check back later."
        />
      )}
    </div>
  );
}

export default MessagesWorkspace;
