import { cn } from '@/lib/utils';
import { Award, Star, Zap, Target, Flame, Trophy, Crown, Gem } from 'lucide-react';
import type { Achievement } from '@/types';

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

const iconMap: Record<string, React.ElementType> = {
  Award,
  Star,
  Zap,
  Target,
  Flame,
  Trophy,
  Crown,
  Gem,
  Footprints: Zap,
};

function AchievementBadgeIcon({
  iconName,
  className,
}: {
  iconName: string;
  className?: string;
}) {
  switch (iconName) {
    case 'Award':
      return <Award className={className} />;
    case 'Star':
      return <Star className={className} />;
    case 'Zap':
    case 'Footprints':
      return <Zap className={className} />;
    case 'Target':
      return <Target className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Trophy':
      return <Trophy className={className} />;
    case 'Crown':
      return <Crown className={className} />;
    case 'Gem':
      return <Gem className={className} />;
    default:
      return <Award className={className} />;
  }
}

const categoryColors: Record<string, { bg: string; border: string; icon: string }> = {
  beginner: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
  },
  intermediate: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
  },
  advanced: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    icon: 'text-violet-400',
  },
  expert: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    icon: 'text-rose-400',
  },
};

export function AchievementBadge({
  achievement,
  size = 'md',
  showDetails = true,
  className,
}: AchievementBadgeProps) {
  const colors = categoryColors[achievement.category] || categoryColors.beginner;

  const sizeVariants = {
    sm: {
      container: 'w-10 h-10',
      icon: 'w-5 h-5',
      text: 'text-xs',
    },
    md: {
      container: 'w-14 h-14',
      icon: 'w-7 h-7',
      text: 'text-sm',
    },
    lg: {
      container: 'w-20 h-20',
      icon: 'w-10 h-10',
      text: 'text-base',
    },
  };

  const sizes = sizeVariants[size];

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 hover:scale-105',
        colors.bg,
        colors.border,
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'rounded-xl flex items-center justify-center flex-shrink-0',
          sizes.container,
          colors.bg.replace('/10', '/20')
        )}
      >
        <AchievementBadgeIcon iconName={achievement.icon_url} className={cn(sizes.icon, colors.icon)} />
      </div>

      {/* Details */}
      {showDetails && (
        <div className="flex-1 min-w-0">
          <h4 className="text-slate-200 font-medium truncate">{achievement.title}</h4>
          <p className="text-slate-500 text-sm truncate">{achievement.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-violet-400 text-xs font-medium">+{achievement.xp_reward} XP</span>
            {achievement.earned_at && (
              <span className="text-slate-600 text-xs">
                Earned {new Date(achievement.earned_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AchievementIcon({
  achievement,
  size = 'md',
  className,
}: Omit<AchievementBadgeProps, 'showDetails'>) {
  const colors = categoryColors[achievement.category] || categoryColors.beginner;

  const sizeVariants = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  };

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center',
        sizeVariants[size],
        colors.bg,
        colors.border,
        'border-2',
        className
      )}
      title={achievement.title}
    >
      <AchievementBadgeIcon iconName={achievement.icon_url} className={cn(iconSizes[size], colors.icon)} />
    </div>
  );
}
