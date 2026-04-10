'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Book,
  ExternalLink,
  Keyboard,
  LayoutGrid,
  List,
  LogOut,
  Play,
  Search,
  Users,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import type { GitHubRepo, Session } from '@/types'

interface CommandPaletteProps {
  repos: GitHubRepo[]
  sessions: Session[]
  viewMode: 'grid' | 'list'
  onStartSession: (repo: GitHubRepo) => void
  onToggleViewMode: () => void
  onLogout: () => void
  userLogin?: string
}

export function CommandPalette({
  repos,
  sessions,
  viewMode,
  onStartSession,
  onToggleViewMode,
  onLogout,
  userLogin,
}: CommandPaletteProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeSessions = sessions.filter((s) => s.active)

  const run = (fn: () => void) => {
    setOpen(false)
    // defer so the close animation doesn't clash with the action
    setTimeout(fn, 0)
  }

  return (
    <>
      {/* Header trigger — button that opens the palette */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="group hidden h-10 w-full max-w-[420px] items-center gap-2.5 rounded-full border border-border/70 bg-card px-4 text-sm text-muted-foreground shadow-sm transition-all hover:border-[#0f5132]/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:flex"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="pointer-events-none hidden items-center gap-0.5 rounded-md border border-border/70 bg-muted px-1.5 font-mono text-[10px] font-semibold text-muted-foreground md:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Icon-only trigger for mobile/tablet */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:border-[#0f5132]/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
      >
        <Search className="h-4 w-4" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search repositories, sessions, or actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {repos.length > 0 && (
            <CommandGroup heading="Repositories">
              {repos.slice(0, 8).map((repo) => (
                <CommandItem
                  key={`repo-${repo.id}`}
                  value={`repo ${repo.full_name} ${repo.description ?? ''}`}
                  onSelect={() => run(() => onStartSession(repo))}
                >
                  <Book className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate">{repo.name}</span>
                  {repo.language && (
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {repo.language}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {activeSessions.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Active Sessions">
                {activeSessions.slice(0, 5).map((session) => (
                  <CommandItem
                    key={`session-${session.id}`}
                    value={`session ${session.repo} ${session.branch}`}
                    onSelect={() => run(() => router.push(`/session/${session.id}`))}
                  >
                    <Users className="mr-2 h-4 w-4 text-[#0f5132]" aria-hidden />
                    <span className="flex-1 truncate">{session.repo}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {session.branch}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              value="toggle view grid list"
              onSelect={() => run(onToggleViewMode)}
            >
              {viewMode === 'grid' ? (
                <List className="mr-2 h-4 w-4" aria-hidden />
              ) : (
                <LayoutGrid className="mr-2 h-4 w-4" aria-hidden />
              )}
              Toggle {viewMode === 'grid' ? 'list' : 'grid'} view
            </CommandItem>
            {userLogin && (
              <CommandItem
                value="open github profile"
                onSelect={() =>
                  run(() =>
                    window.open(`https://github.com/${userLogin}`, '_blank', 'noopener,noreferrer')
                  )
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                Open GitHub profile
                <CommandShortcut>
                  <Keyboard className="h-3 w-3" aria-hidden />
                </CommandShortcut>
              </CommandItem>
            )}
            <CommandItem
              value="sign out log out"
              onSelect={() => run(onLogout)}
              className="text-destructive data-[selected=true]:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              Sign out
            </CommandItem>
          </CommandGroup>

          {repos.length > 0 && activeSessions.length === 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Quick Start">
                <CommandItem
                  value="start new session quick"
                  onSelect={() => run(() => onStartSession(repos[0]))}
                >
                  <Play className="mr-2 h-4 w-4 fill-current" aria-hidden />
                  Start session in {repos[0].name}
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
