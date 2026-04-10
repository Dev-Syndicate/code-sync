'use client'

import { useEffect, useState } from 'react'
import { Activity, Radio } from 'lucide-react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  formatRelativeSync,
  useSystemStatus,
  type SystemStatus,
} from '@/hooks/useSystemStatus'

interface StatusVisuals {
  label: string
  dot: string
  ring: string
  text: string
}

const STATUS_VISUALS: Record<SystemStatus, StatusVisuals> = {
  connected: {
    label: 'Connected',
    dot: 'bg-emerald-500',
    ring: 'bg-emerald-500/40',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  reconnecting: {
    label: 'Reconnecting',
    dot: 'bg-amber-500',
    ring: 'bg-amber-500/40',
    text: 'text-amber-700 dark:text-amber-400',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-rose-500',
    ring: 'bg-rose-500/40',
    text: 'text-rose-700 dark:text-rose-400',
  },
}

function StatusDot({ status }: { status: SystemStatus }) {
  const v = STATUS_VISUALS[status]
  return (
    <span className="relative flex size-2.5 items-center justify-center">
      {status !== 'offline' ? (
        <span
          className={cn(
            'absolute inline-flex size-2.5 animate-ping rounded-full',
            v.ring,
          )}
        />
      ) : null}
      <span className={cn('relative inline-flex size-2 rounded-full', v.dot)} />
    </span>
  )
}

export function SystemStatusCard() {
  const { status, online, activeSessionCount, lastSyncedAt } = useSystemStatus()
  const v = STATUS_VISUALS[status]

  // Re-render every 30s so the "synced X ago" line stays current even if
  // nothing else triggers a render. The hook itself ticks every 15s for
  // the threshold check, but this guarantees the popover label is fresh.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group w-full rounded-2xl border border-border/60 bg-card p-4 text-left transition-colors hover:border-emerald-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:border-emerald-800/60"
          aria-label="View system status"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              System
            </span>
            <StatusDot status={status} />
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className={cn('text-sm font-semibold', v.text)}>
              {v.label}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatRelativeSync(lastSyncedAt)}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Activity className="size-3" strokeWidth={2.5} />
              <span>
                <span className="font-semibold text-foreground">
                  {activeSessionCount}
                </span>{' '}
                active
              </span>
            </div>
            <span className="text-[11px] font-medium text-emerald-700 transition-colors group-hover:text-emerald-600 dark:text-emerald-400">
              View status →
            </span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        className="w-72 p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-muted-foreground" strokeWidth={2} />
            <span className="text-sm font-semibold text-foreground">
              System status
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={status} />
            <span className={cn('text-xs font-semibold', v.text)}>
              {v.label}
            </span>
          </div>
        </div>

        <dl className="divide-y divide-border/60">
          <StatusRow
            label="Network"
            value={online ? 'Online' : 'Offline'}
            tone={online ? 'good' : 'bad'}
          />
          <StatusRow
            label="Last sync"
            value={formatRelativeSync(lastSyncedAt)}
            mono
          />
          <StatusRow
            label="Active sessions"
            value={activeSessionCount.toString()}
          />
          <StatusRow label="Region" value="auto" mono muted />
        </dl>

        <p className="border-t border-border/60 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          {status === 'connected' ? (
            <>All systems normal. Session data is fresh and your network is reachable.</>
          ) : status === 'reconnecting' ? (
            <>Waiting on a fresh sync from Firestore. Your edits will resume as soon as the connection recovers.</>
          ) : (
            <>You appear to be offline. Reconnect to a network to resume real-time collaboration.</>
          )}
        </p>
      </PopoverContent>
    </Popover>
  )
}

function StatusRow({
  label,
  value,
  mono = false,
  muted = false,
  tone,
}: {
  label: string
  value: string
  mono?: boolean
  muted?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'text-xs font-semibold',
          mono && 'font-mono',
          muted ? 'text-muted-foreground' : 'text-foreground',
          tone === 'good' && 'text-emerald-700 dark:text-emerald-400',
          tone === 'bad' && 'text-rose-700 dark:text-rose-400',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
