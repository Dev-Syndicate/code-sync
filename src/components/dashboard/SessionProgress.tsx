'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import type { Session } from '@/types'

interface SessionProgressProps {
  sessions: Session[]
}

export function SessionProgress({ sessions }: SessionProgressProps) {
  const { completed, inProgress, pending, total, percentage } = useMemo(() => {
    const total = sessions.length
    const inProgress = sessions.filter((s) => s.active).length
    const completed = sessions.filter((s) => !s.active && s.closedAt).length
    const pending = total - inProgress - completed
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)
    return { completed, inProgress, pending, total, percentage }
  }, [sessions])

  // SVG arc geometry
  const radius = 70
  const strokeWidth = 14
  const circumference = 2 * Math.PI * radius
  // Half circle so we render an arc, not a full ring
  const halfCircumference = circumference / 2
  const offset = halfCircumference - (percentage / 100) * halfCircumference

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-4">
        <h3 className="text-base font-bold text-foreground">Session Progress</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {total === 0 ? 'No sessions yet' : `${total} total session${total === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Half-circle gauge — flex-1 grows to fill */}
      <div className="relative mx-auto flex flex-1 w-full max-w-[220px] items-center justify-center">
        <svg
          width="200"
          height="120"
          viewBox="0 0 200 120"
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Track */}
          <path
            d={`M ${100 - radius} 100 A ${radius} ${radius} 0 0 1 ${100 + radius} 100`}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={`M ${100 - radius} 100 A ${radius} ${radius} 0 0 1 ${100 + radius} 100`}
            fill="none"
            stroke="url(#progress-gradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={halfCircumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <p className="text-4xl font-extrabold tabular-nums leading-none text-foreground">
            {percentage}%
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Sessions Closed
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-auto space-y-2 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Completed</span>
          </div>
          <span className="font-bold tabular-nums text-foreground">{completed}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">In Progress</span>
          </div>
          <span className="font-bold tabular-nums text-foreground">{inProgress}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            <span className="text-muted-foreground">Pending</span>
          </div>
          <span className="font-bold tabular-nums text-foreground">{pending}</span>
        </div>
      </div>
    </Card>
  )
}
