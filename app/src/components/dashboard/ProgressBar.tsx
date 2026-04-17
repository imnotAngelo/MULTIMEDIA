import { cn } from '@/lib/utils';

interface ProgressBarProps {
  progress: number;
  className?: string;
  barClassName?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'success' | 'warning' | 'error';
}

const sizeVariants = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const colorVariants = {
  default: 'bg-violet-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
};

export function ProgressBar({
  progress,
  className,
  barClassName,
  showPercentage = false,
  size = 'md',
  color = 'default',
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-3">
        <div className={cn('flex-1 bg-slate-800 rounded-full overflow-hidden', sizeVariants[size])}>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              colorVariants[color],
              barClassName
            )}
            style={{ width: `${clampedProgress}%` }}
          >
            {/* Shimmer Effect */}
            <div className="h-full w-full relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
            </div>
          </div>
        </div>
        {showPercentage && (
          <span className="text-sm font-medium text-slate-400 min-w-[3rem] text-right">
            {clampedProgress}%
          </span>
        )}
      </div>
    </div>
  );
}
