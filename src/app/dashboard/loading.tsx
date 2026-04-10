import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar skeleton */}
        <aside className="fixed left-0 top-0 hidden h-screen w-[240px] flex-col border-r border-border/60 bg-sidebar p-5 lg:flex">
          <div className="mb-8 flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="mb-3 h-3 w-12" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mb-3 mt-8 h-3 w-16" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
          <div className="mt-auto">
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        </aside>

        <div className="flex-1 lg:pl-[240px]">
          {/* Top bar skeleton */}
          <div className="border-b border-border/60 bg-background/85">
            <div className="flex h-[72px] items-center justify-between gap-4 px-6 sm:px-8">
              <Skeleton className="hidden h-10 w-[420px] max-w-full rounded-full lg:block" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="hidden h-10 w-36 rounded-full sm:block" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </div>
          </div>

          {/* Main skeleton */}
          <div className="mx-auto max-w-[1280px] px-6 py-8 sm:px-8">
            {/* Hero */}
            <div className="mb-8">
              <Skeleton className="mb-2 h-10 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>

            {/* Stats strip */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-5">
                  <Skeleton className="mb-3 h-10 w-10 rounded-xl" />
                  <Skeleton className="mb-2 h-2.5 w-24" />
                  <Skeleton className="h-8 w-12" />
                </Card>
              ))}
            </div>

            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Skeleton className="h-10 w-[280px] max-w-full rounded-full" />
              <Skeleton className="h-10 w-[150px] rounded-full" />
              <Skeleton className="h-10 w-[150px] rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
              <div className="flex-1" />
              <Skeleton className="h-10 w-20 rounded-full" />
            </div>

            {/* Repo cards */}
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
      </div>
    </div>
  )
}
