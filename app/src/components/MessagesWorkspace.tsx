import { useState } from 'react';
import { Megaphone, MessageSquare } from 'lucide-react';
import { AnnouncementGroup } from './AnnouncementGroup';
import { ConversationView } from './ConversationView';

interface MessagesWorkspaceProps {
  instructor: boolean;
}

export function MessagesWorkspace({ instructor }: MessagesWorkspaceProps) {
  const [view, setView] = useState<'private' | 'announcements'>('private');

  return (
    <div>
      <div className="px-6 pt-6 max-w-7xl mx-auto">
        <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900/70 p-1 gap-1">
          <button
            type="button"
            onClick={() => setView('private')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${view === 'private' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <MessageSquare className="w-4 h-4" />
            Private Messages
          </button>
          <button
            type="button"
            onClick={() => setView('announcements')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${view === 'announcements' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
          >
            <Megaphone className="w-4 h-4" />
            Class Announcements
          </button>
        </div>
      </div>
      {view === 'announcements' ? <AnnouncementGroup canPost={instructor} /> : instructor ? <ConversationView title="Private Messages" subtitle="Reply to student inquiries and questions" emptyContactsLabel="No students have registered yet." /> : <ConversationView title="Private Messages" subtitle="Send your inquiries and questions to your instructor" emptyContactsLabel="No instructors are available yet. Please check back later." />}
    </div>
  );
}
