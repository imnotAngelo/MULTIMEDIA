import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'cyan';
  className?: string;
}

const colorVariants = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    icon: 'text-blue-500',
  },
  green: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    icon: 'text-emerald-500',
  },
  yellow: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    icon: 'text-amber-500',
  },
  purple: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    icon: 'text-violet-500',
  },
  red: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    icon: 'text-rose-500',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    icon: 'text-cyan-500',
  },
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue',
  className,
}: StatsCardProps) {
  const colors = colorVariants[color];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/5',
        colors.bg,
        colors.border,
        className
      )}
    >
      {/* Background Gradient */}
      <div className={cn('absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-20 blur-2xl', colors.bg.replace('/10', ''))} />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <h3 className={cn('text-3xl font-bold mt-1', colors.text)}>
              {value}
            </h3>
          </div>
          <div className={cn('p-2.5 rounded-lg bg-slate-900/50', colors.icon)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-3">
          {trend && (
            <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
              <TrendIcon className="w-3 h-3" />
              <span>{trendValue}</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
