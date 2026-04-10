import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border/50 bg-background/80">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="mx-auto max-w-[1280px] px-6 py-8 sm:px-8 sm:py-10">
        {/* Hero skeleton */}
        <div className="mb-10">
          <Skeleton className="mb-2 h-10 w-80" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Toolbar skeleton */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-[280px] max-w-full" />
          <Skeleton className="h-10 w-[160px]" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-20" />
        </div>

        {/* Repo cards skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="p-5"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-[90%]" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-3 pt-2">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-2.5 w-10" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
