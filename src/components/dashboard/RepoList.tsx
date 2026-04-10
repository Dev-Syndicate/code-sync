'use client'

import { AlertCircle, Book, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { GitHubRepo } from '@/types'
import { RepoCard } from './RepoCard'

interface RepoListProps {
  repos: GitHubRepo[]
  loading: boolean
  error: string | null
  viewMode: 'grid' | 'list'
  pinnedRepoIds: number[]
  onStartSession: (repo: GitHubRepo) => void
  onTogglePin: (id: number) => void
  onRetry: () => void
}

function SkeletonCard({ viewMode }: { viewMode: 'grid' | 'list' }) {
  const isGrid = viewMode === 'grid'
  return (
    <Card
      className={cn(
        isGrid ? 'p-5 flex flex-col gap-3.5' : 'p-4 px-5 flex flex-row items-center gap-5'
      )}
    >
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-[90%]" />
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      </div>
      {isGrid && <Skeleton className="h-9 w-full rounded-md" />}
    </Card>
  )
}

export function RepoList({
  repos,
  loading,
  error,
  viewMode,
  pinnedRepoIds,
  onStartSession,
  onTogglePin,
  onRetry,
}: RepoListProps) {
  const gridClasses = cn(
    'grid gap-4',
    viewMode === 'grid'
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]'
      : 'grid-cols-1'
  )

  // Loading state
  if (loading) {
    return (
      <div className={gridClasses} aria-busy="true" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} viewMode={viewMode} />
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 mb-4">
          <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
        </div>
        <p className="text-base font-semibold text-foreground mb-1.5">
          Failed to load repositories
        </p>
        <p className="text-sm text-muted-foreground mb-5">{error}</p>
        <Button onClick={onRetry}>Try Again</Button>
      </div>
    )
  }

  // Empty state
  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <Book className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-base font-semibold text-foreground mb-1.5">
          No repositories found
        </p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search or filter criteria
        </p>
      </div>
    )
  }

  // Split pinned / unpinned (repos is already sorted with pinned first by the store)
  const pinnedSet = new Set(pinnedRepoIds)
  const pinned = repos.filter((r) => pinnedSet.has(r.id))
  const unpinned = repos.filter((r) => !pinnedSet.has(r.id))

  return (
    <div className="space-y-6">
      {pinned.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Star className="h-3.5 w-3.5 fill-[#0f5132] text-[#0f5132]" aria-hidden />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pinned
            </h3>
          </div>
          <div className={gridClasses}>
            {pinned.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                viewMode={viewMode}
                isPinned
                onStartSession={onStartSession}
                onTogglePin={onTogglePin}
              />
            ))}
          </div>
        </div>
      )}

      {unpinned.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                All Repositories
              </h3>
            </div>
          )}
          <div className={gridClasses}>
            {unpinned.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                viewMode={viewMode}
                isPinned={false}
                onStartSession={onStartSession}
                onTogglePin={onTogglePin}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
