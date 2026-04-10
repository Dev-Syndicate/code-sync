'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Bell,
  Book,
  Code2,
  ExternalLink,
  Mail,
  Moon,
  Shield,
  Star,
  Sun,
  Users,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/hooks/useAuth'
import { useRepoStore } from '@/store/repoStore'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'

export default function ProfilePage() {
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth()
  const { repos, pinnedRepoIds } = useRepoStore()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [mounted, setMounted] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.replace('/login')
  }

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/sessions')
        if (res.status === 401) {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
          window.location.replace('/login')
          return
        }
        const json = await res.json()
        if (!cancelled && json.success) {
          setAllSessions(json.data ?? [])
        }
      } catch (err) {
        console.error('[ProfilePage] Failed to fetch sessions:', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated])

  const isDark = (resolvedTheme ?? theme) === 'dark'

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : '—'

  const stats = [
    {
      label: 'Repositories',
      value: repos.length,
      icon: Book,
    },
    {
      label: 'Sessions Joined',
      value: allSessions.length,
      icon: Users,
    },
    {
      label: 'Pinned Repos',
      value: pinnedRepoIds.length,
      icon: Star,
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* Shared sidebar */}
        <Sidebar />

        {/* Main content */}
        <div className="flex-1 lg:pl-[240px]">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
            <div className="flex h-[72px] items-center justify-between gap-4 px-6 sm:px-8">
              {/* Mobile logo */}
              <div className="flex items-center gap-2.5 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-500">
                  <Code2 className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
                </div>
                <span className="text-lg font-extrabold">CodeSync</span>
              </div>

              {/* Back link on desktop */}
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:inline-flex"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>

              <div className="flex-1" />

              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/70 text-muted-foreground hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell className="h-[18px] w-[18px]" />
                </Button>

                <ThemeToggle />

                <Separator orientation="vertical" className="hidden h-8 sm:block" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        'flex items-center gap-2.5 rounded-full p-0.5 transition-colors',
                        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                      )}
                      aria-label="Open user menu"
                    >
                      <Avatar className="h-10 w-10 ring-2 ring-border/60">
                        <AvatarImage src={user?.avatar} alt={user?.username ?? 'User'} />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-700 to-emerald-500 text-xs font-bold text-white">
                          {user?.username?.charAt(0).toUpperCase() ?? 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {user && (
                        <div className="hidden flex-col items-start pr-2 text-left sm:flex">
                          <span className="text-[13px] font-semibold leading-tight text-foreground">
                            {user.name || user.username}
                          </span>
                          <span className="text-[11px] leading-tight text-muted-foreground">
                            @{user.username}
                          </span>
                        </div>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {user && (
                      <>
                        <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-0.5">
                            <p className="text-sm font-semibold leading-none">
                              {user.name || user.username}
                            </p>
                            <p className="text-xs leading-none text-muted-foreground">
                              @{user.username}
                            </p>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main */}
          <main className="mx-auto max-w-[1080px] px-6 py-8 sm:px-8 sm:py-10">
            {/* Hero */}
            <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <h1 className="mb-1 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-[32px]">
                Profile & Settings
              </h1>
              <p className="text-[15px] text-muted-foreground">
                Manage your account, preferences, and GitHub integration.
              </p>
            </div>

            {/* Profile header card */}
            <Card
              className="relative mb-6 overflow-hidden p-0 animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}
            >
              {/* Cover gradient */}
              <div className="h-28 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900">
                <div
                  className="absolute right-6 top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"
                  aria-hidden
                />
              </div>

              {/* Profile body */}
              <div className="relative -mt-10 flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:gap-8">
                <Avatar className="h-24 w-24 shrink-0 ring-4 ring-card shadow-lg">
                  <AvatarImage src={user?.avatar} alt={user?.username ?? 'User'} />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-700 to-emerald-500 text-2xl font-bold text-white">
                    {user?.username?.charAt(0).toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                      {user?.name || user?.username || 'User'}
                    </h2>
                    <Badge
                      variant="secondary"
                      className="border-0 bg-primary/10 text-primary hover:bg-primary/15"
                    >
                      <Code2 className="mr-1 h-3 w-3" />
                      GitHub
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    @{user?.username ?? '—'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {user?.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {user.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Member since {memberSince}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {user?.username && (
                    <a
                      href={`https://github.com/${user.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" className="gap-1.5 rounded-full">
                        <ExternalLink className="h-3.5 w-3.5" />
                        View on GitHub
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </Card>

            {/* Stats row */}
            <div
              className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}
            >
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <Card key={stat.label} className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="mt-1 text-3xl font-extrabold tabular-nums text-foreground">
                          {stat.value}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/15">
                        <Icon className="h-5 w-5 text-primary" strokeWidth={2.25} />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Two-column settings row */}
            <div
              className="grid grid-cols-1 gap-4 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}
            >
              {/* Appearance */}
              <Card className="p-6">
                <h3 className="text-base font-bold text-foreground">Appearance</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose how CodeSync looks to you. Select a theme.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    aria-pressed={mounted && !isDark}
                    className={cn(
                      'group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      mounted && !isDark
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:border-primary/40'
                    )}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-200">
                      <Sun className="h-5 w-5 text-amber-600" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    aria-pressed={mounted && isDark}
                    className={cn(
                      'group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      mounted && isDark
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:border-primary/40'
                    )}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 ring-1 ring-slate-700">
                      <Moon className="h-5 w-5 text-slate-300" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Dark</span>
                  </button>
                </div>
              </Card>

              {/* Account */}
              <Card className="p-6">
                <h3 className="text-base font-bold text-foreground">Account</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Manage your account and session.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Connected Account
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Signed in via GitHub OAuth
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="border-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    >
                      Connected
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Sign out
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        End your session and return to login
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
