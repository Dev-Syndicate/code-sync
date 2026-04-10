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
        'group cursor-pointer p-5 transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-[#0f5132]/40 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Circle
            className="h-2 w-2 shrink-0 animate-pulse fill-[#22c55e] text-[#22c55e]"
            aria-hidden
          />
          <span className="truncate text-sm font-bold text-foreground">
            {session.repo}
          </span>
        </div>
        <Badge
          variant="secondary"
          className="border-0 bg-[#dcfce7] font-semibold text-[#0f5132] hover:bg-[#bbf7d0]"
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
                className="h-8 w-8 border-2 border-card ring-0"
                title={p.username}
              >
                <AvatarImage src={p.avatar} alt={p.username} />
                <AvatarFallback
                  style={{ background: p.color }}
                  className="text-[11px] font-bold text-white"
                >
                  {p.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {participantCount}/{session.maxParticipants}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" aria-hidden />
          <span className="max-w-[100px] truncate font-medium">{session.branch}</span>
          <ArrowRight
            className="ml-1 h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            aria-hidden
          />
        </div>
      </div>
    </Card>
  )
}
