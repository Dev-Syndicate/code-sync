'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Code2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const primaryNav = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
]

const secondaryNav = [
  { label: 'Settings', icon: Settings, href: '/dashboard/profile' },
  { label: 'Help', icon: HelpCircle, href: '/dashboard/help' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()

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
    </aside>
  )
}
