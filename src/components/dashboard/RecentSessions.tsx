'use client'

import { useRouter } from 'next/navigation'
import { Clock, History, Play } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Session } from '@/types'

function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const then = date.getTime()
  const diffMs = now - then
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface RecentSessionsProps {
  sessions: Session[]
  max?: number
}

export function RecentSessions({ sessions, max = 5 }: RecentSessionsProps) {
  const router = useRouter()

  // Sort by lastDraftAt desc, fallback to createdAt
  const recent = [...sessions]
    .sort((a, b) => {
      const aTime = (a.lastDraftAt ?? a.createdAt)?.toDate?.().getTime() ?? 0
      const bTime = (b.lastDraftAt ?? b.createdAt)?.toDate?.().getTime() ?? 0
      return bTime - aTime
    })
    .slice(0, max)

  if (recent.length === 0) return null

  return (
    <section className="mb-10">
      <div className="mb-3.5 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="text-base font-bold">Recent Sessions</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {recent.map((session) => {
          const lastActive = (session.lastDraftAt ?? session.createdAt)?.toDate?.() ?? new Date()
          return (
            <Card
              key={session.id}
              className="group relative flex min-w-[260px] snap-start flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-brand-mint)]">
                    {session.repo}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {session.branch}
                  </p>
                </div>
                {session.active && (
                  <span className="shrink-0 rounded-full bg-[#408A71]/15 px-2 py-0.5 text-[10px] font-semibold text-[#B0E4CC]">
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  {formatRelativeTime(lastActive)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => router.push(`/session/${session.id}`)}
                >
                  <Play className="h-3 w-3 fill-current" aria-hidden />
                  Resume
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
