'use client'

import { Activity, Book, Star, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatTile {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'mint'
}

interface StatsStripProps {
  repoCount: number
  activeSessionCount: number
  sessionsJoined: number
  pinnedCount: number
}

export function StatsStrip({
  repoCount,
  activeSessionCount,
  sessionsJoined,
  pinnedCount,
}: StatsStripProps) {
  const tiles: StatTile[] = [
    { label: 'Repositories', value: repoCount, icon: Book },
    { label: 'Active Sessions', value: activeSessionCount, icon: Activity, tone: 'mint' },
    { label: 'Sessions Joined', value: sessionsJoined, icon: Users },
    { label: 'Pinned', value: pinnedCount, icon: Star, tone: 'mint' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {tiles.map((tile) => {
        const Icon = tile.icon
        const isMint = tile.tone === 'mint'
        return (
          <Card
            key={tile.label}
            className={cn(
              'relative overflow-hidden p-4 transition-all duration-300',
              'hover:ring-1 hover:ring-primary/30 hover:shadow-[0_4px_16px_-8px_rgba(64,138,113,0.35)]'
            )}
          >
            {/* Ambient accent glow */}
            <div
              className={cn(
                'pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl',
                isMint ? 'bg-[#B0E4CC]/10' : 'bg-[#408A71]/10'
              )}
              aria-hidden
            />
            <div className="relative flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tile.label}
                </span>
                <span className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                  {tile.value}
                </span>
              </div>
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  isMint
                    ? 'bg-[#B0E4CC]/15 text-[#B0E4CC]'
                    : 'bg-[#408A71]/15 text-[#408A71]'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
