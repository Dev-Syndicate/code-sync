'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ArrowDownAZ,
  ChevronsLeftRight,
  Filter,
  LayoutGrid,
  List,
  LogOut,
  Search,
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
    // Wait for AuthProvider to hydrate before hitting protected endpoints
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
      {/* ── Header Bar ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-6 sm:px-8">
          {/* Logo lockup */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#285A48] to-[#408A71] shadow-lg shadow-[#408A71]/20">
              <ChevronsLeftRight className="h-[18px] w-[18px] text-[#B0E4CC]" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-extrabold tracking-tight">
              <span className="text-[var(--color-brand-mint)]">Code</span>
              <span className="text-foreground">Sync</span>
            </span>
          </div>

          {/* ⌘K command palette trigger */}
          <CommandPalette
            repos={allRepos}
            sessions={allSessions}
            viewMode={viewMode}
            onStartSession={handleStartSession}
            onToggleViewMode={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            onLogout={() => logout()}
            userLogin={user?.username}
          />

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2.5 rounded-full p-0.5 pr-3 transition-colors',
                  'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                )}
                aria-label="Open user menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} alt={user?.username ?? 'User'} />
                  <AvatarFallback className="bg-gradient-to-br from-[#285A48] to-[#408A71] text-xs font-bold text-[#B0E4CC]">
                    {user?.username?.charAt(0).toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
                {user && (
                  <span className="hidden text-sm text-muted-foreground sm:inline">
                    {user.username}
                  </span>
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
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto max-w-[1280px] px-6 py-8 sm:px-8 sm:py-10">
        {/* Hero / Greeting */}
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h1 className="mb-1.5 text-[32px] font-extrabold leading-tight tracking-tight sm:text-4xl">
            {user ? (
              <>
                Welcome back, <span className="text-[var(--color-brand-mint)]">{user.username}</span>
              </>
            ) : (
              <>
                Welcome to <span className="text-[var(--color-brand-mint)]">CodeSync</span>
              </>
            )}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Select a repository to start a collaborative coding session
          </p>
        </div>

        {/* ── Stats Strip ── */}
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
          <StatsStrip
            repoCount={allRepos.length}
            activeSessionCount={activeSessions.length}
            sessionsJoined={allSessions.length}
            pinnedCount={pinnedCount}
          />
        </div>

        {/* ── Active Sessions Section ── */}
        {!sessionsLoading && activeSessions.length > 0 && (
          <section className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}>
            <div className="mb-3.5 flex items-center gap-2">
              <h2 className="text-base font-bold">Active Sessions</h2>
              <Badge
                variant="secondary"
                className="border-0 bg-[#408A71]/15 text-[#B0E4CC] hover:bg-[#408A71]/20"
              >
                {activeSessions.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
              {activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </section>
        )}

        {/* ── Recent Sessions ── */}
        {!sessionsLoading && allSessions.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}>
            <RecentSessions sessions={allSessions} />
          </div>
        )}

        {/* ── Repositories Section ── */}
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: '320ms', animationFillMode: 'backwards' }}>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-bold">Your Repositories</h2>
            {!loading && (
              <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">
                {repos.length}
              </Badge>
            )}
          </div>

          {/* Toolbar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
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
                className="pl-9"
              />
            </div>

            {/* Language filter */}
            <Select
              value={languageFilter ?? 'all'}
              onValueChange={(v) => setLanguageFilter(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[150px]" aria-label="Filter by language">
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
              <SelectTrigger className="w-[140px] gap-1.5" aria-label="Sort repositories">
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
                  className="h-9 gap-1.5"
                  aria-label="Advanced filters"
                >
                  <Filter className="h-3.5 w-3.5" aria-hidden />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 h-4 border-0 bg-primary/20 px-1.5 text-[10px] text-[#B0E4CC]"
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
            <div className="flex overflow-hidden rounded-md border border-border bg-card">
              <Button
                id="view-grid"
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={cn(
                  'h-9 w-9 rounded-none',
                  viewMode === 'grid'
                    ? 'bg-accent text-foreground hover:bg-accent'
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
                  'h-9 w-9 rounded-none',
                  viewMode === 'list'
                    ? 'bg-accent text-foreground hover:bg-accent'
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
