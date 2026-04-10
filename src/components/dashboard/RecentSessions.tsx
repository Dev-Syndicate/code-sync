'use client'

import { useMemo } from 'react'
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

  const recent = useMemo(() => {
    return [...sessions]
      .sort((a, b) => {
        const aTime = (a.lastDraftAt ?? a.createdAt)?.toDate?.().getTime() ?? 0
        const bTime = (b.lastDraftAt ?? b.createdAt)?.toDate?.().getTime() ?? 0
        return bTime - aTime
      })
      .slice(0, max)
  }, [sessions, max])

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Recent Sessions</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {recent.length === 0
              ? 'No sessions yet'
              : `Last ${recent.length} session${recent.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/15">
          <History className="h-[18px] w-[18px] text-primary" strokeWidth={2.25} />
        </div>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <History className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-medium text-foreground">No recent sessions</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your latest sessions will appear here
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto">
          {recent.map((session) => {
            const lastActive =
              (session.lastDraftAt ?? session.createdAt)?.toDate?.() ?? new Date()
            return (
              <div
                key={session.id}
                className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-foreground">
                      {session.repo}
                    </p>
                    {session.active && (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{session.branch}</span>
                    <span aria-hidden>·</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden />
                      {formatRelativeTime(lastActive)}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 shrink-0 gap-1 rounded-full px-3 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => router.push(`/session/${session.id}`)}
                >
                  <Play className="h-3 w-3 fill-current" aria-hidden />
                  Resume
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
