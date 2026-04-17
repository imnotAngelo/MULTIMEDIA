import { Play, Check, Lock, BookOpen, Image, Film, Music, MousePointer, Box, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from './ProgressBar';
import { cn } from '@/lib/utils';
import type { Module } from '@/types';

interface UnitProgressCardProps {
  module: Module;
  onContinue?: () => void;
  onStart?: () => void;
}

const moduleIcons: Record<string, React.ElementType> = {
  'Unit 0': BookOpen,
  'Unit I': BookOpen,
  'Unit II': Image,
  'Unit III': Film,
  'Unit IV': MousePointer,
  'Unit V': Music,
  'Unit VI': Box,
  'Unit VII': Globe,
};

const getModuleIcon = (title: string) => {
  for (const [key, icon] of Object.entries(moduleIcons)) {
    if (title.startsWith(key)) return icon;
  }
  return BookOpen;
};

const getStatusColor = (progress: number, status: string) => {
  if (status === 'locked') return 'gray';
  if (progress === 100) return 'success';
  if (progress >= 50) return 'warning';
  return 'default';
};

const getStatusText = (progress: number, status: string) => {
  if (status === 'locked') return 'Locked';
  if (progress === 100) return 'Completed';
  if (progress > 0) return 'In Progress';
  return 'Not Started';
};

export function UnitProgressCard({ module, onContinue, onStart }: UnitProgressCardProps) {
  const Icon = getModuleIcon(module.title);
  const isLocked = module.status === 'locked';
  const isCompleted = module.progress === 100;
  const isInProgress = module.progress && module.progress > 0 && module.progress < 100;

  return (
    <div
      className={cn(
        'group relative rounded-xl border p-4 transition-all duration-300',
        isLocked
          ? 'bg-slate-900/30 border-slate-800/50'
          : 'bg-slate-900/60 border-slate-800 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
            isLocked
              ? 'bg-slate-800 text-slate-600'
              : 'bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20'
          )}
        >
          <Icon className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={cn('font-semibold truncate', isLocked ? 'text-slate-500' : 'text-slate-200')}>
                {module.title}
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">{module.description}</p>
            </div>
            <span
              className={cn(
                'text-xs font-medium px-2 py-1 rounded-full flex-shrink-0',
                isLocked && 'bg-slate-800 text-slate-500',
                isCompleted && 'bg-emerald-500/10 text-emerald-400',
                isInProgress && 'bg-amber-500/10 text-amber-400',
                !module.progress && !isLocked && 'bg-slate-800 text-slate-400'
              )}
            >
              {getStatusText(module.progress || 0, module.status)}
            </span>
          </div>

          {/* Progress */}
          {!isLocked && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500">
                  {module.completed_lessons} of {module.total_lessons} lessons
                </span>
                <span className={cn(
                  'font-medium',
                  isCompleted ? 'text-emerald-400' : 'text-slate-400'
                )}>
                  {module.progress}%
                </span>
              </div>
              <ProgressBar
                progress={module.progress || 0}
                size="sm"
                color={getStatusColor(module.progress || 0, module.status) as 'default' | 'success' | 'warning' | 'error'}
              />
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex-shrink-0">
          {isLocked ? (
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Lock className="w-4 h-4 text-slate-600" />
            </div>
          ) : isCompleted ? (
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
          ) : (
            <Button
              size="sm"
              onClick={isInProgress ? onContinue : onStart}
              className={cn(
                'gap-1.5',
                isInProgress
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-violet-500 hover:bg-violet-600 text-white'
              )}
            >
              <Play className="w-3.5 h-3.5" />
              {isInProgress ? 'Continue' : 'Start'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
