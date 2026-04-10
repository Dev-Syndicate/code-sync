'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Code2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Radio,
  Settings,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSessionStore } from '@/store/sessionStore'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'

const primaryNav = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
]

const secondaryNav = [
  { label: 'Settings', icon: Settings, href: '/dashboard/profile' },
  { label: 'Help', icon: HelpCircle, href: '/dashboard/help' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { logout, isAuthenticated } = useAuth()
  const sessions = useSessionStore((s) => s.sessions)
  const setSessions = useSessionStore((s) => s.setSessions)

  // The dashboard page fetches sessions and populates the store, but the
  // sidebar also renders on /dashboard/help and /dashboard/profile where
  // that fetch hasn't run. Do a one-shot fill-if-empty so the card isn't
  // stuck in a "no data" state when the user deep-links into a subpage.
  useEffect(() => {
    if (!isAuthenticated || sessions.length > 0) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/sessions', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json?.success && Array.isArray(json.data)) {
          setSessions(json.data as Session[])
        }
      } catch (err) {
        console.error('[Sidebar] session fetch failed:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, sessions.length, setSessions])

  // "Active now" — live sessions + total seats across them. The owner is
  // not always in the participants map (see join route), so count them
  // separately when absent.
  const { liveCount, seatCount } = useMemo(() => {
    const live = sessions.filter((s) => s.active)
    let seats = 0
    for (const s of live) {
      const participantIds = s.participants ? Object.keys(s.participants) : []
      seats += participantIds.length
      if (s.owner && !participantIds.includes(s.owner)) seats += 1
    }
    return { liveCount: live.length, seatCount: seats }
  }, [sessions])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const handleLogout = async () => {
    await logout()
    // replace() — not href/push — so the previous (authenticated) page is
    // removed from history. Pressing Back on the login page must NOT restore
    // the dashboard, which would momentarily show stale user data.
    window.location.replace('/login')
  }

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-[240px] flex-col border-r border-border/60 bg-sidebar p-5 lg:flex">
      {/* Logo */}
      <Link href="/dashboard" className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-500 shadow-sm shadow-emerald-700/20">
          <Code2 className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-extrabold tracking-tight text-foreground">
          CodeSync
        </span>
      </Link>

      {/* Menu label */}
      <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Menu
      </p>

      {/* Primary nav */}
      <nav className="space-y-1">
        {primaryNav.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* General section */}
      <p className="mb-3 mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        General
      </p>
      <nav className="space-y-1">
        {secondaryNav.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          Logout
        </button>
      </nav>

      {/* Active now — live sessions snapshot */}
      <Link
        href="/dashboard#active-sessions"
        className="group mt-auto block rounded-2xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-accent"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Radio className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Active now
          </span>
          {liveCount > 0 && (
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
        </div>

        {liveCount === 0 ? (
          <p className="text-xs text-muted-foreground">
            No live sessions. Pick a repo to start one.
          </p>
        ) : (
          <div className="flex items-baseline gap-3">
            <div>
              <p className="text-2xl font-extrabold leading-none text-foreground">
                {liveCount}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                session{liveCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              <Users className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              {seatCount}
            </div>
          </div>
        )}
      </Link>
    </aside>
  )
}
