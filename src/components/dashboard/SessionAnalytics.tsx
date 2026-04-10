'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'

interface SessionAnalyticsProps {
  sessions: Session[]
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function SessionAnalytics({ sessions }: SessionAnalyticsProps) {
  const { buckets, max, total, todayIndex } = useMemo(() => {
    // Build a 7-day bucket: index 0 = 6 days ago, index 6 = today
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const buckets = Array(7).fill(0) as number[]
    const labels = Array(7).fill('') as string[]

    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      labels[i] = DAY_LABELS[d.getDay()]
    }

    sessions.forEach((s) => {
      const created = s.createdAt?.toDate?.() ?? null
      if (!created) return
      const sessionDay = new Date(
        created.getFullYear(),
        created.getMonth(),
        created.getDate()
      )
      const diffDays = Math.floor(
        (today.getTime() - sessionDay.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diffDays >= 0 && diffDays <= 6) {
        buckets[6 - diffDays] += 1
      }
    })

    const max = Math.max(...buckets, 1)
    const total = buckets.reduce((a, b) => a + b, 0)

    return { buckets, max, total, todayIndex: 6, labels }
  }, [sessions])

  // Generate the same labels for rendering (avoid recomputing)
  const labels = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      return DAY_LABELS[d.getDay()]
    })
  }, [])

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Session Analytics</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sessions created in the last 7 days
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold tabular-nums text-foreground">{total}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Total
          </p>
        </div>
      </div>

      <div className="flex min-h-[220px] flex-1 items-end justify-between gap-2">
        {buckets.map((count, i) => {
          const isToday = i === todayIndex
          const heightPct = (count / max) * 100
          return (
            <div
              key={i}
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
            >
              {/* Bar */}
              <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-t-lg bg-muted">
                <div
                  className={cn(
                    'w-full rounded-t-lg transition-all duration-500 ease-out',
                    isToday
                      ? 'bg-gradient-to-t from-primary to-primary/60'
                      : 'bg-gradient-to-t from-primary/40 to-primary/20'
                  )}
                  style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 0)}%` }}
                  aria-hidden
                />
                {count > 0 && (
                  <span
                    className={cn(
                      'absolute left-1/2 top-1 -translate-x-1/2 text-[10px] font-bold tabular-nums',
                      isToday ? 'text-primary-foreground' : 'text-foreground/70'
                    )}
                  >
                    {count}
                  </span>
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  'text-[11px] font-semibold',
                  isToday ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {labels[i]}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
