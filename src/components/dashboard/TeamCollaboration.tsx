'use client'

import { useMemo } from 'react'
import { Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Session } from '@/types'

interface TeamCollaborationProps {
  sessions: Session[]
}

interface Collaborator {
  username: string
  avatar: string
  color: string
  sessionCount: number
  activeRepo: string | null
  isOnline: boolean
  lastSeen: number
}

export function TeamCollaboration({ sessions }: TeamCollaborationProps) {
  const collaborators = useMemo(() => {
    const map = new Map<string, Collaborator>()

    sessions.forEach((session) => {
      const isActive = session.active
      Object.entries(session.participants).forEach(([, participant]) => {
        const existing = map.get(participant.username)
        const joinedAt = participant.joinedAt?.toDate?.().getTime() ?? 0
        if (existing) {
          existing.sessionCount += 1
          existing.lastSeen = Math.max(existing.lastSeen, joinedAt)
          if (isActive && !existing.isOnline) {
            existing.isOnline = true
            existing.activeRepo = session.repo
          }
        } else {
          map.set(participant.username, {
            username: participant.username,
            avatar: participant.avatar,
            color: participant.color,
            sessionCount: 1,
            activeRepo: isActive ? session.repo : null,
            isOnline: isActive,
            lastSeen: joinedAt,
          })
        }
      })
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
      return b.lastSeen - a.lastSeen
    })
  }, [sessions])

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Team Collaboration</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {collaborators.length === 0
              ? 'No collaborators yet'
              : `${collaborators.length} collaborator${collaborators.length === 1 ? '' : 's'} across your sessions`}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/15">
          <Users className="h-[18px] w-[18px] text-primary" strokeWidth={2.25} />
        </div>
      </div>

      {collaborators.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-medium text-foreground">No collaborators yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start a session and invite teammates to see them here
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto">
          {collaborators.slice(0, 5).map((c) => (
            <div
              key={c.username}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:bg-accent"
            >
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={c.avatar} alt={c.username} />
                  <AvatarFallback
                    style={{ background: c.color }}
                    className="text-xs font-bold text-white"
                  >
                    {c.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {c.isOnline && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500"
                    aria-label="Online"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">
                  {c.username}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.isOnline && c.activeRepo
                    ? `Working on ${c.activeRepo}`
                    : `${c.sessionCount} session${c.sessionCount === 1 ? '' : 's'}`}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={
                  c.isOnline
                    ? 'border-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-0 bg-muted text-muted-foreground'
                }
              >
                {c.isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
