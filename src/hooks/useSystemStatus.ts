'use client'

import { useEffect, useState } from 'react'
import { useSessionStore } from '@/store/sessionStore'

export type SystemStatus = 'connected' | 'reconnecting' | 'offline'

export interface SystemStatusSnapshot {
  status: SystemStatus
  online: boolean
  activeSessionCount: number
  lastSyncedAt: number | null
}

/**
 * Lightweight, dashboard-safe status hook.
 *
 * There is no Yjs WebSocket provider on the dashboard — that only exists
 * inside an active session. So "connected" here means: the browser reports
 * itself as online AND we have received fresh data from the backend within
 * the recent past. If the browser is offline, status is 'offline'. If we
 * are online but haven't synced in over a minute, status is 'reconnecting'.
 */
export function useSystemStatus(): SystemStatusSnapshot {
  const sessions = useSessionStore((s) => s.sessions)
  const lastSyncedAt = useSessionStore((s) => s.lastSyncedAt)

  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  // `now` ticks every 15s so the freshness threshold stays current without
  // calling impure Date.now() during render.
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 15_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.clearInterval(interval)
    }
  }, [])

  const activeSessionCount = sessions.filter(
    (session) => session.active && !session.closedAt,
  ).length

  let status: SystemStatus
  if (!online) {
    status = 'offline'
  } else if (lastSyncedAt === null || now - lastSyncedAt > 60_000) {
    status = 'reconnecting'
  } else {
    status = 'connected'
  }

  return { status, online, activeSessionCount, lastSyncedAt }
}

export function formatRelativeSync(timestamp: number | null): string {
  if (timestamp === null) return 'never'
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
