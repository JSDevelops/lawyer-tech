// Reusable skeleton loader components for consistent loading states across all pages

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />
}

export function StatCardSkeleton() {
  return (
    <div className="card border border-white/5 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <Skeleton className="w-4 h-4 rounded" />
      </div>
      <Skeleton className="w-16 h-7 rounded-lg" />
      <Skeleton className="w-24 h-4 rounded" />
      <Skeleton className="w-32 h-3 rounded" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  const widths = ['w-32', 'w-24', 'w-20', 'w-16', 'w-12']
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-4 px-4 border-b border-white/3">
          <Skeleton className={`h-4 rounded ${widths[i % widths.length]}`} />
        </td>
      ))}
    </tr>
  )
}

export function CardSkeleton() {
  return (
    <div className="card border border-white/5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-5/6 rounded" />
    </div>
  )
}

export function ListItemSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 border-b border-white/4">
          <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className={`h-4 rounded ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
            <Skeleton className="h-3 rounded w-1/3" />
          </div>
          <Skeleton className="w-16 h-6 rounded-full" />
        </div>
      ))}
    </>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card">
          <Skeleton className="h-5 w-32 rounded mb-4" />
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-3 border-b border-white/4">
                <Skeleton className="flex-1 h-4 rounded" />
                <Skeleton className="w-20 h-4 rounded" />
                <Skeleton className="w-16 h-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="card space-y-3">
          <Skeleton className="h-5 w-28 rounded mb-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function PageLoader({ text = 'กำลังโหลด...' }: { text?: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20" />
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent absolute inset-0 animate-spin" />
        </div>
        <p className="text-sm text-slate-500 font-medium">{text}</p>
      </div>
    </div>
  )
}
