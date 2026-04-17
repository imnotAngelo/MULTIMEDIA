import { cn } from '@/lib/utils';
import { Trophy, Medal, Award, Flame } from 'lucide-react';
import type { LeaderboardEntry } from '@/types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  className?: string;
}

const rankIcons = [Trophy, Medal, Award];
const rankColors = [
  'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  'text-slate-300 bg-slate-300/10 border-slate-300/30',
  'text-amber-600 bg-amber-600/10 border-amber-600/30',
];

export function Leaderboard({ entries, currentUserId, className }: LeaderboardProps) {
  return (
    <div className={cn('bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Leaderboard</h3>
            <p className="text-sm text-slate-500">Top performers this week</p>
          </div>
          <div className="flex items-center gap-2 text-amber-400">
            <Flame className="w-5 h-5" />
            <span className="text-sm font-medium">Weekly</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-800">
        {entries.map((entry, index) => {
          const isCurrentUser = entry.user_id === currentUserId;
          const rank = index + 1;
          const RankIcon = rankIcons[index] || null;
          const rankColor = rankColors[index] || 'text-slate-400 bg-slate-800/50 border-slate-700';

          return (
            <div
              key={entry.user_id}
              className={cn(
                'flex items-center gap-4 p-4 transition-colors',
                isCurrentUser ? 'bg-violet-500/5' : 'hover:bg-slate-800/30'
              )}
            >
              {/* Rank */}
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border',
                  rank <= 3 ? rankColor : 'text-slate-400 bg-slate-800/50 border-slate-700'
                )}
              >
                {RankIcon ? <RankIcon className="w-5 h-5" /> : rank}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden">
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt={entry.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-semibold text-sm">
                    {entry.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={cn(
                      'font-medium truncate',
                      isCurrentUser ? 'text-violet-400' : 'text-slate-200'
                    )}
                  >
                    {entry.full_name}
                  </h4>
                  {isCurrentUser && (
                    <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{entry.achievement_count} achievements</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" />
                    {entry.streak_days} day streak
                  </span>
                </div>
              </div>

              {/* XP */}
              <div className="text-right">
                <span className="text-lg font-bold text-violet-400">
                  {entry.xp_total.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 block">XP</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/30">
        <button className="w-full text-center text-sm text-violet-400 hover:text-violet-300 transition-colors">
          View Full Leaderboard →
        </button>
      </div>
    </div>
  );
}
