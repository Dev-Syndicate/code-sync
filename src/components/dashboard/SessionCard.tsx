'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Circle, GitBranch } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'

interface SessionCardProps {
  session: Session
}

export function SessionCard({ session }: SessionCardProps) {
  const router = useRouter()
  const participantList = Object.values(session.participants)
  const participantCount = participantList.length

  const handleOpen = () => {
    router.push(`/session/${session.id}`)
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleOpen()
        }
      }}
      className={cn(
        'group cursor-pointer p-4 transition-all duration-200',
        'hover:-translate-y-0.5 hover:ring-1 hover:ring-[#B0E4CC]/40',
        'hover:shadow-[0_8px_24px_-12px_rgba(176,228,204,0.25)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Circle
            className="h-2 w-2 shrink-0 fill-emerald-500 text-emerald-500 animate-pulse"
            aria-hidden
          />
          <span className="truncate text-sm font-semibold text-foreground">
            {session.repo}
          </span>
        </div>
        <Badge
          variant="secondary"
          className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 border-0"
        >
          Live
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {participantList.slice(0, 3).map((p, i) => (
              <Avatar
                key={i}
                className="h-7 w-7 border-2 border-card ring-0"
                title={p.username}
              >
                <AvatarImage src={p.avatar} alt={p.username} />
                <AvatarFallback
                  style={{ background: p.color }}
                  className="text-[10px] font-bold text-white"
                >
                  {p.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {participantCount}/{session.maxParticipants}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" aria-hidden />
          <span className="truncate max-w-[100px]">{session.branch}</span>
          <ArrowRight
            className="h-3 w-3 ml-1 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
            aria-hidden
          />
        </div>
      </div>
    </Card>
  )
}
