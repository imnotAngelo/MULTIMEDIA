import {
  Skeleton,
  SkeletonCardGrid,
  SkeletonDashboard,
  SkeletonDocument,
  SkeletonList,
  SkeletonTable,
} from '@/components/ui/skeleton';

export type AetherLoaderVariant =
  | 'auto'
  | 'dashboard'
  | 'cards'
  | 'table'
  | 'document'
  | 'compact'
  | 'list';

interface AetherLoaderProps {
  label?: string;
  compact?: boolean;
  variant?: AetherLoaderVariant;
  count?: number;
  className?: string;
}

export function AetherLoader({
  label = 'Loading your learning space',
  compact = false,
  variant = 'auto',
  count,
  className = '',
}: AetherLoaderProps) {
  // Infer layout variant if 'auto'
  const resolvedVariant = (() => {
    if (variant !== 'auto') return variant;
    if (compact) return 'compact';
    const lower = label.toLowerCase();
    if (
      lower.includes('dashboard') ||
      lower.includes('command center') ||
      lower.includes('stats')
    ) {
      return 'dashboard';
    }
    if (
      lower.includes('document') ||
      lower.includes('slide') ||
      lower.includes('pdf') ||
      lower.includes('exam') ||
      lower.includes('quiz taker') ||
      lower.includes('workspace')
    ) {
      return 'document';
    }
    if (
      lower.includes('table') ||
      lower.includes('index') ||
      lower.includes('request') ||
      lower.includes('score') ||
      lower.includes('approval') ||
      lower.includes('performance') ||
      lower.includes('library')
    ) {
      return 'table';
    }
    if (lower.includes('announcement') || lower.includes('feed')) {
      return 'list';
    }
    return 'cards';
  })();

  if (resolvedVariant === 'compact') {
    return (
      <div className={`flex items-center gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 ${className}`}>
        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{label}</span>
          </div>
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full space-y-6 animate-in fade-in duration-200 ${className}`} role="status" aria-live="polite">
      {/* Sleek status indicator pill */}
      {label && (
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm text-xs font-medium text-slate-700 dark:text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            <span>{label}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        </div>
      )}

      {/* Render selected skeleton structure */}
      {resolvedVariant === 'dashboard' && <SkeletonDashboard />}
      {resolvedVariant === 'cards' && <SkeletonCardGrid count={count || 3} />}
      {resolvedVariant === 'table' && <SkeletonTable rows={count || 5} />}
      {resolvedVariant === 'document' && <SkeletonDocument />}
      {resolvedVariant === 'list' && <SkeletonList count={count || 4} />}
    </div>
  );
}