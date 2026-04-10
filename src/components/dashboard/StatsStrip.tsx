'use client'

import { Activity, Book, Star, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatTile {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  accent: 'primary' | 'mint'
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
    { label: 'Total Repositories', value: repoCount, icon: Book, accent: 'primary' },
    { label: 'Active Sessions', value: activeSessionCount, icon: Activity, accent: 'mint' },
    { label: 'Sessions Joined', value: sessionsJoined, icon: Users, accent: 'primary' },
    { label: 'Pinned Repos', value: pinnedCount, icon: Star, accent: 'mint' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <Card
            key={tile.label}
            className={cn(
              'relative overflow-hidden p-5 transition-all duration-300',
              'hover:-translate-y-0.5 hover:shadow-md'
            )}
          >
            {/* Decorative blob — bottom-left */}
            <svg
              className="pointer-events-none absolute -bottom-6 -right-4 h-24 w-24 opacity-60"
              viewBox="0 0 100 100"
              fill="none"
              aria-hidden
            >
              <path
                d="M 20,60 Q 30,40 50,50 T 80,40 Q 90,55 80,75 T 40,80 Q 15,80 20,60 Z"
                fill={tile.accent === 'mint' ? '#bbf7d0' : '#dcfce7'}
              />
              <path
                d="M 30,65 Q 40,50 55,55 T 75,50 Q 82,62 72,75 T 45,80 Q 28,78 30,65 Z"
                fill={tile.accent === 'mint' ? '#86efac' : '#bbf7d0'}
                opacity="0.7"
              />
            </svg>

            {/* Small green dots cluster */}
            <div className="pointer-events-none absolute right-4 top-5 flex gap-1" aria-hidden>
              <span className="h-1 w-1 rounded-full bg-[#0f5132]/60" />
              <span className="h-1 w-1 rounded-full bg-[#0f5132]/40" />
              <span className="h-1 w-1 rounded-full bg-[#0f5132]/20" />
            </div>

            <div className="relative">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f5132]/8 ring-1 ring-inset ring-[#0f5132]/15">
                <Icon className="h-[18px] w-[18px] text-[#0f5132]" strokeWidth={2.25} />
              </div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tile.label}
              </p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                {tile.value}
              </p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
