'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowDownAZ,
  Bell,
  Book,
  Filter,
  Code2,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRepos } from '@/hooks/useRepos'
import { useSessionStore } from '@/store/sessionStore'
import { RepoList } from '@/components/dashboard/RepoList'
import { CreateSession } from '@/components/dashboard/CreateSession'
import { SessionCard } from '@/components/dashboard/SessionCard'
import { StatsStrip } from '@/components/dashboard/StatsStrip'
import { RecentSessions } from '@/components/dashboard/RecentSessions'
import { CommandPalette } from '@/components/dashboard/CommandPalette'
import { SessionAnalytics } from '@/components/dashboard/SessionAnalytics'
import { TeamCollaboration } from '@/components/dashboard/TeamCollaboration'
import { SessionProgress } from '@/components/dashboard/SessionProgress'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { GitHubRepo, Session } from '@/types'

// ── Sidebar nav items ──────────────────────────────────────────────
const primaryNav = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#dashboard', active: true },
  { label: 'Sessions', icon: Activity, href: '#active-sessions' },
  { label: 'Repositories', icon: Book, href: '#repositories' },
  { label: 'Team', icon: Users, href: '#team' },
]

const secondaryNav = [
  { label: 'Settings', icon: Settings, href: '#settings' },
  { label: 'Help', icon: HelpCircle, href: '#help' },
]

export default function DashboardPage() {
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth()
  const {
    repos,
    allRepos,
    loading,
    error,
    searchQuery,
    languageFilter,
    viewMode,
    sortBy,
    visibilityFilter,
    hideForks,
    pinnedRepoIds,
    languages,
    setSearchQuery,
    setLanguageFilter,
    setViewMode,
    setSortBy,
    setVisibilityFilter,
    setHideForks,
    togglePinned,
    refetch,
  } = useRepos()

  const { sessions, setSessions } = useSessionStore()
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [allSessions, setAllSessions] = useState<Session[]>([])

  // Fetch active sessions from the real API
  useEffect(() => {
    if (authLoading || !isAuthenticated) return

    let cancelled = false

    async function fetchSessions() {
      setSessionsLoading(true)
      try {
        const res = await fetch('/api/sessions')

        if (res.status === 401) {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
          window.location.replace('/login')
          return
        }

        const json = await res.json()

        if (!cancelled && json.success) {
          const data: Session[] = json.data ?? []
          setAllSessions(data)
          setSessions(data)
        }
      } catch (err) {
        console.error('[DashboardPage] Failed to fetch sessions:', err)
      } finally {
        if (!cancelled) {
          setSessionsLoading(false)
        }
      }
    }

    fetchSessions()

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, setSessions])

  const activeSessions = useMemo(() => sessions.filter((s) => s.active), [sessions])
  const pinnedCount = pinnedRepoIds.length

  function handleStartSession(repo: GitHubRepo) {
    setSelectedRepo(repo)
    setIsCreateOpen(true)
  }

  const activeFilterCount =
    (visibilityFilter !== 'all' ? 1 : 0) + (hideForks ? 1 : 0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* ═══ Sidebar ═══ */}
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
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    item.active
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  {item.label}
                </a>
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
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  {item.label}
                </a>
              )
            })}
            <button
              type="button"
              onClick={() => logout()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
              Logout
            </button>
          </nav>

          {/* Promo card */}
          <div className="mt-auto">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 p-5 text-white">
              <div
                className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10 blur-xl"
                aria-hidden
              />
              <div className="relative">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Activity className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <p className="mb-1 text-sm font-bold">Live Collaboration</p>
                <p className="mb-3 text-[11px] leading-relaxed text-white/75">
                  Real-time coding with your team, powered by GitHub.
                </p>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition-colors hover:bg-white/90"
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* ═══ Main content ═══ */}
        <div className="flex-1 lg:pl-[240px]">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
            <div className="flex h-[72px] items-center justify-between gap-4 px-6 sm:px-8">
              {/* Mobile logo (hidden on lg+) */}
              <div className="flex items-center gap-2.5 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-500">
                  <Code2 className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
                </div>
                <span className="text-lg font-extrabold">CodeSync</span>
              </div>

              {/* ⌘K palette */}
              <div className="hidden flex-1 justify-center lg:flex">
                <CommandPalette
                  repos={allRepos}
                  sessions={allSessions}
                  viewMode={viewMode}
                  onStartSession={handleStartSession}
                  onToggleViewMode={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  onLogout={() => logout()}
                  userLogin={user?.username}
                />
              </div>

              {/* Right side: notifications + add + user */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Mobile palette trigger is rendered inside CommandPalette */}
                <div className="lg:hidden">
                  <CommandPalette
                    repos={allRepos}
                    sessions={allSessions}
                    viewMode={viewMode}
                    onStartSession={handleStartSession}
                    onToggleViewMode={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    onLogout={() => logout()}
                    userLogin={user?.username}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell className="h-[18px] w-[18px]" />
                </Button>

                {/* Theme toggle */}
                <ThemeToggle />

                {/* Primary action */}
                {allRepos.length > 0 && (
                  <Button
                    onClick={() => handleStartSession(allRepos[0])}
                    className="hidden h-10 gap-1.5 rounded-full bg-primary px-4 font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 sm:inline-flex"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    New Session
                  </Button>
                )}

                <Separator orientation="vertical" className="hidden h-8 sm:block" />

                {/* User dropdown */}
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
                      onClick={() => logout()}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main content area */}
          <main className="mx-auto max-w-[1280px] px-6 py-8 sm:px-8">
            {/* Hero / Greeting */}
            <div
              id="dashboard"
              className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              <h1 className="mb-1 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-[32px]">
                Dashboard
              </h1>
              <p className="text-[15px] text-muted-foreground">
                {user ? (
                  <>
                    Welcome back, <span className="font-semibold text-foreground">{user.username}</span> — plan, prioritize, and collaborate on your repos with ease.
                  </>
                ) : (
                  'Plan, prioritize, and collaborate on your repos with ease.'
                )}
              </p>
            </div>

            {/* ── Stats Strip ── */}
            <div
              className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}
            >
              <StatsStrip
                repoCount={allRepos.length}
                activeSessionCount={activeSessions.length}
                sessionsJoined={allSessions.length}
                pinnedCount={pinnedCount}
              />
            </div>

            {/* ── Analytics + Progress Row ── */}
            {!sessionsLoading && (
              <div
                className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}
              >
                <div className="lg:col-span-2">
                  <SessionAnalytics sessions={allSessions} />
                </div>
                <div>
                  <SessionProgress sessions={allSessions} />
                </div>
              </div>
            )}

            {/* ── Team Collaboration + Recent Sessions Row ── */}
            {!sessionsLoading && (
              <div
                className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}
              >
                <TeamCollaboration sessions={allSessions} />
                <RecentSessions sessions={allSessions} />
              </div>
            )}

            {/* ── Active Sessions Section ── */}
            {!sessionsLoading && activeSessions.length > 0 && (
              <section
                id="active-sessions"
                className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: '220ms', animationFillMode: 'backwards' }}
              >
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Active Sessions</h2>
                  <Badge
                    variant="secondary"
                    className="border-0 bg-primary/10 text-primary hover:bg-primary/15"
                  >
                    {activeSessions.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                  {activeSessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Repositories Section ── */}
            <section
              id="repositories"
              className="animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: '320ms', animationFillMode: 'backwards' }}
            >
              <div className="mb-5 flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">Your Repositories</h2>
                {!loading && (
                  <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">
                    {repos.length}
                  </Badge>
                )}
              </div>

              {/* Toolbar */}
              <div className="mb-6 flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative max-w-[360px] flex-[1_1_250px]">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="repo-search"
                    type="text"
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search repositories"
                    className="h-10 rounded-full border-border/70 bg-card pl-10 shadow-sm"
                  />
                </div>

                {/* Language filter */}
                <Select
                  value={languageFilter ?? 'all'}
                  onValueChange={(v) => setLanguageFilter(v === 'all' ? null : v)}
                >
                  <SelectTrigger
                    className="h-10 w-[150px] rounded-full border-border/70 bg-card shadow-sm"
                    aria-label="Filter by language"
                  >
                    <SelectValue placeholder="All Languages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    {languages.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger
                    className="h-10 w-[150px] gap-1.5 rounded-full border-border/70 bg-card shadow-sm"
                    aria-label="Sort repositories"
                  >
                    <ArrowDownAZ className="h-3.5 w-3.5" aria-hidden />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recently updated</SelectItem>
                    <SelectItem value="stars">Most stars</SelectItem>
                    <SelectItem value="name">Name (A–Z)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Advanced filters popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 gap-1.5 rounded-full border-border/70 bg-card shadow-sm"
                      aria-label="Advanced filters"
                    >
                      <Filter className="h-3.5 w-3.5" aria-hidden />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-0.5 h-4 border-0 bg-primary px-1.5 text-[10px] text-primary-foreground"
                        >
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Visibility
                        </Label>
                        <Select
                          value={visibilityFilter}
                          onValueChange={(v) => setVisibilityFilter(v as typeof visibilityFilter)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All repos</SelectItem>
                            <SelectItem value="public">Public only</SelectItem>
                            <SelectItem value="private">Private only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="hide-forks"
                          checked={hideForks}
                          onCheckedChange={(v) => setHideForks(v === true)}
                        />
                        <Label
                          htmlFor="hide-forks"
                          className="cursor-pointer text-sm font-normal"
                        >
                          Hide forks
                        </Label>
                      </div>

                      {activeFilterCount > 0 && (
                        <>
                          <Separator />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              setVisibilityFilter('all')
                              setHideForks(false)
                            }}
                          >
                            Clear filters
                          </Button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="flex-1" />

                {/* View mode toggle */}
                <div className="flex h-10 overflow-hidden rounded-full border border-border/70 bg-card shadow-sm">
                  <Button
                    id="view-grid"
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    aria-pressed={viewMode === 'grid'}
                    className={cn(
                      'h-10 w-10 rounded-none',
                      viewMode === 'grid'
                        ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    id="view-list"
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    aria-pressed={viewMode === 'list'}
                    className={cn(
                      'h-10 w-10 rounded-none',
                      viewMode === 'list'
                        ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Repo list/grid */}
              <RepoList
                repos={repos}
                loading={loading}
                error={error}
                viewMode={viewMode}
                pinnedRepoIds={pinnedRepoIds}
                onStartSession={handleStartSession}
                onTogglePin={togglePinned}
                onRetry={refetch}
              />
            </section>
          </main>
        </div>
      </div>

      {/* ── Create Session Dialog ── */}
      {selectedRepo && (
        <CreateSession
          repo={selectedRepo}
          isOpen={isCreateOpen}
          onClose={() => {
            setIsCreateOpen(false)
            setSelectedRepo(null)
          }}
        />
      )}
    </div>
  )
}
