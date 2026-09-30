import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/80",
        className
      )}
      {...props}
    />
  )
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/60 space-y-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-1/3 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="space-y-2 pt-1">
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-3 w-3/5 rounded" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}

function SkeletonCardGrid({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

function SkeletonTableRow() {
  return (
    <div className="flex items-center justify-between py-3.5 px-4 border-b border-slate-200/70 dark:border-slate-800/70 gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-4 w-2/5 rounded" />
          <Skeleton className="h-3 w-1/4 rounded" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 rounded-full shrink-0" />
      <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
    </div>
  )
}

function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden shadow-sm",
        className
      )}
    >
      {/* Table Header Filter / Search bar skeleton */}
      <div className="p-4 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </div>
    </div>
  )
}

function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-xl border border-slate-200/70 bg-white/60 dark:border-slate-800/70 dark:bg-slate-900/40 gap-4"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  )
}

function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6 max-w-7xl mx-auto", className)}>
      {/* Banner Skeleton */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 p-6 sm:p-8 space-y-4">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-9 w-2/3 max-w-md rounded-xl" />
        <Skeleton className="h-4 w-1/2 max-w-sm rounded" />
      </div>

      {/* KPI Stats Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-6 w-6 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        ))}
      </div>

      {/* Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40 rounded" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-3">
          <Skeleton className="h-6 w-32 rounded mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkeletonDocument({ className }: { className?: string }) {
  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Document toolbar skeleton */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Document page canvas skeleton */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 p-8 sm:p-12 min-h-[500px] flex flex-col items-center justify-center space-y-6">
        <Skeleton className="h-8 w-2/3 max-w-lg rounded-xl" />
        <div className="w-full max-w-xl space-y-3">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-4 w-full rounded" />
        </div>
        <Skeleton className="h-48 w-full max-w-xl rounded-2xl" />
        <div className="w-full max-w-xl space-y-2">
          <Skeleton className="h-3 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      </div>
    </div>
  )
}

function SkeletonChat({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 space-y-4", className)}>
      <div className="flex justify-start">
        <div className="space-y-1 max-w-[70%]">
          <Skeleton className="h-12 w-52 rounded-2xl" />
          <Skeleton className="h-2.5 w-14 rounded" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="space-y-1 max-w-[70%] items-end flex flex-col">
          <Skeleton className="h-10 w-44 rounded-2xl" />
          <Skeleton className="h-2.5 w-14 rounded" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="space-y-1 max-w-[70%]">
          <Skeleton className="h-16 w-64 rounded-2xl" />
          <Skeleton className="h-2.5 w-14 rounded" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="space-y-1 max-w-[70%] items-end flex flex-col">
          <Skeleton className="h-8 w-36 rounded-2xl" />
          <Skeleton className="h-2.5 w-14 rounded" />
        </div>
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonCardGrid,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonList,
  SkeletonDashboard,
  SkeletonDocument,
  SkeletonChat,
}
