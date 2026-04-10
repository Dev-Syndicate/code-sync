'use client'

import { Book, GitFork, Play, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GitHubRepo } from '@/types'

// ── Language color map (matches GitHub's language colors) ──
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Ruby: '#701516',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
  Shell: '#89e051',
}

function getLanguageColor(language: string | null): string {
  if (!language) return '#6b7280'
  return LANGUAGE_COLORS[language] ?? '#6b7280'
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface RepoCardProps {
  repo: GitHubRepo
  viewMode: 'grid' | 'list'
  isPinned: boolean
  onStartSession: (repo: GitHubRepo) => void
  onTogglePin: (id: number) => void
}

export function RepoCard({ repo, viewMode, isPinned, onStartSession, onTogglePin }: RepoCardProps) {
  const isGrid = viewMode === 'grid'

  return (
    <Card
      onClick={() => onStartSession(repo)}
      className={cn(
        'group relative cursor-pointer transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-[#0f5132]/40 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isPinned && 'border-[#0f5132]/30 bg-gradient-to-br from-card to-[#dcfce7]/30',
        isGrid ? 'flex flex-col gap-3.5 p-5' : 'flex flex-row items-center gap-5 p-4 px-5'
      )}
    >
      {/* Pin button — absolute top-right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onTogglePin(repo.id)
        }}
        aria-label={isPinned ? 'Unpin repository' : 'Pin repository'}
        aria-pressed={isPinned}
        className={cn(
          'absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-all',
          'opacity-0 group-hover:opacity-100',
          isPinned && 'opacity-100',
          'hover:bg-accent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <Star
          className={cn(
            'h-4 w-4 transition-colors',
            isPinned ? 'fill-[#0f5132] text-[#0f5132]' : 'text-muted-foreground'
          )}
        />
      </button>

      {/* Repo info */}
      <div className="min-w-0 flex-1 pr-8">
        {/* Name + badges row */}
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Book className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-[15px] font-bold text-foreground">
            {repo.name}
          </span>

          <Badge
            variant="outline"
            className="border-border/70 bg-muted/50 text-[11px] font-medium text-muted-foreground"
          >
            {repo.private ? 'Private' : 'Public'}
          </Badge>

          {repo.fork && (
            <Badge
              variant="outline"
              className="gap-1 border-border/70 bg-muted/50 text-[11px] font-medium text-muted-foreground"
            >
              <GitFork className="h-3 w-3" aria-hidden />
              Fork
            </Badge>
          )}
        </div>

        {/* Description */}
        {repo.description && (
          <p
            className={cn(
              'mb-2.5 overflow-hidden text-[13px] leading-relaxed text-muted-foreground',
              isGrid ? 'line-clamp-2' : 'line-clamp-1'
            )}
          >
            {repo.description}
          </p>
        )}

        {/* Meta row: language + stars + updated */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {repo.language && (
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background"
                style={{ background: getLanguageColor(repo.language) }}
                aria-hidden
              />
              {repo.language}
            </span>
          )}

          {repo.stargazers_count > 0 && (
            <span className="flex items-center gap-1 font-medium">
              <Star className="h-3.5 w-3.5" aria-hidden />
              {repo.stargazers_count}
            </span>
          )}

          <span className="text-muted-foreground/70">
            Updated {getRelativeTime(repo.updated_at)}
          </span>
        </div>
      </div>

      {/* Start session button */}
      <Button
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onStartSession(repo)
        }}
        className="shrink-0 gap-1.5 rounded-full bg-[#0f5132] font-semibold text-white shadow-sm hover:bg-[#0a3d25]"
      >
        <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
        Start Session
      </Button>
    </Card>
  )
}
