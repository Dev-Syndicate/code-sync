'use client'

import { useState, useRef, useEffect } from 'react'
import { Book, Check, DoorOpen, GitBranch, Loader2, MoreVertical, PowerOff } from 'lucide-react'
import type { ConnectionStatus } from '@/hooks/useConnectionStatus'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

interface HeaderParticipant {
  uid: string
  username: string
  avatar?: string
  color?: string
}

interface SessionHeaderProps {
  connectionStatus: ConnectionStatus
  repoName?: string
  branch?: string
  participants?: HeaderParticipant[]
  /** Current user — so we can flag "You" in the avatar row. */
  currentUserId?: string
  /** True when the current user owns the session. Unlocks End-session menu. */
  isHost?: boolean
  /** Host-only callback. Called when the End-session menu item is picked. */
  onEndSession?: () => void
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; label: string }
> = {
  connected:    { color: 'bg-emerald-500',               label: 'Live' },
  connecting:   { color: 'bg-yellow-500 animate-pulse',  label: 'Connecting' },
  disconnected: { color: 'bg-red-500',                   label: 'Offline' },
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function SessionHeader({
  connectionStatus,
  repoName = 'Repository',
  branch = 'main',
  participants = [],
  currentUserId,
  isHost = false,
  onEndSession,
}: SessionHeaderProps) {
  const statusCfg = STATUS_CONFIG[connectionStatus]

  // ── Confirm dialogs (themed replacements for window.confirm) ───────────
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [endConfirmOpen, setEndConfirmOpen] = useState(false)

  // ── Host overflow menu ─────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  // Split repo into "owner/name" so we can emphasize the repo name.
  const [repoOwner, repoShortName] = repoName.includes('/')
    ? repoName.split('/', 2)
    : ['', repoName]

  // ── Branch dropdown ────────────────────────────────────────────────────
  //
  // The session is pinned to whatever branch it was started on — you
  // can't hot-swap branches mid-session without rehydrating files and
  // reconciling drafts. The dropdown is therefore read-only: it shows
  // every branch on the repo (so users know what else exists), with
  // the current branch highlighted and a footer note explaining that
  // starting a new session is the way to switch.
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const branchMenuRef = useRef<HTMLDivElement>(null)
  const [branchList, setBranchList] = useState<string[] | null>(null)
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchError, setBranchError] = useState<string | null>(null)

  useEffect(() => {
    if (!branchMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!branchMenuRef.current?.contains(e.target as Node)) {
        setBranchMenuOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBranchMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [branchMenuOpen])

  // Lazy-fetch branches the first time the dropdown opens. We key the
  // cache on repoName so switching sessions re-fetches cleanly.
  useEffect(() => {
    if (!branchMenuOpen) return
    if (branchList !== null) return
    if (!repoOwner || !repoShortName) return

    let cancelled = false
    const ac = new AbortController()
    setBranchLoading(true)
    setBranchError(null)

    void (async () => {
      try {
        const res = await fetch(
          `/api/repos?owner=${encodeURIComponent(repoOwner)}&repo=${encodeURIComponent(repoShortName)}&branches=1`,
          {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin',
            signal: ac.signal,
          },
        )
        if (cancelled) return
        if (!res.ok) {
          setBranchError('Failed to load branches.')
          return
        }
        const json = await res.json()
        if (!json?.success || !Array.isArray(json.data)) {
          setBranchError('Unexpected response.')
          return
        }
        const names = (json.data as Array<{ name: string }>).map((b) => b.name)
        // Put the current branch first; sort the rest alphabetically.
        const rest = names.filter((n) => n !== branch).sort()
        const current = names.includes(branch) ? [branch] : []
        if (!cancelled) setBranchList([...current, ...rest])
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[SessionHeader] fetch branches failed:', err)
        if (!cancelled) setBranchError('Failed to load branches.')
      } finally {
        if (!cancelled) setBranchLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [branchMenuOpen, branchList, repoOwner, repoShortName, branch])

  // Cap the avatar row. Show up to 5; collapse the rest into a "+N" badge.
  const MAX_AVATARS = 5
  const visibleParticipants = participants.slice(0, MAX_AVATARS)
  const overflowCount = Math.max(participants.length - MAX_AVATARS, 0)

  return (
    <header className="relative z-30 flex items-center gap-3 px-4 h-12 bg-card border-b border-border shrink-0">
      {/* ── Repo identity ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0 shrink">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
          <Book className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
        <h1 className="flex min-w-0 items-baseline gap-1 text-sm truncate max-w-[48ch]">
          {repoOwner && (
            <>
              <span className="text-muted-foreground truncate">{repoOwner}</span>
              <span className="text-muted-foreground/50">/</span>
            </>
          )}
          <span className="font-semibold text-foreground truncate">
            {repoShortName}
          </span>
        </h1>
      </div>

      {/* ── Branch pill (read-only dropdown of real repo branches) ────── */}
      <div ref={branchMenuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setBranchMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={branchMenuOpen}
          className={cn(
            'group inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            branchMenuOpen && 'bg-accent text-foreground',
          )}
          title={`Branch: ${branch}`}
        >
          <GitBranch className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          {branch}
        </button>
        {branchMenuOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg bg-popover shadow-[0_0_0_1px_rgba(16,185,129,0.3),_0_0_20px_rgba(16,185,129,0.18),_0_0_50px_rgba(16,185,129,0.1)]"
          >
            <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Branches
            </div>
            <div className="max-h-64 overflow-y-auto">
              {branchLoading && (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Loading branches…
                </div>
              )}
              {branchError && !branchLoading && (
                <div className="px-3 py-3 text-xs text-destructive">
                  {branchError}
                </div>
              )}
              {branchList && !branchLoading && branchList.length === 0 && (
                <div className="px-3 py-3 text-xs text-muted-foreground">
                  No branches found.
                </div>
              )}
              {branchList &&
                !branchLoading &&
                branchList.map((b) => {
                  const isCurrent = b === branch
                  return (
                    <div
                      key={b}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm',
                        isCurrent
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground',
                      )}
                      title={
                        isCurrent
                          ? 'Current branch'
                          : 'Start a new session to use this branch'
                      }
                    >
                      <GitBranch
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isCurrent ? 'text-primary' : 'text-muted-foreground',
                        )}
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="truncate">{b}</span>
                      {isCurrent && (
                        <Check
                          className="ml-auto h-3.5 w-3.5 shrink-0 text-primary"
                          strokeWidth={2.5}
                          aria-label="Current branch"
                        />
                      )}
                    </div>
                  )
                })}
            </div>
            <div className="border-t border-border bg-muted/40 px-3 py-2 text-[10px] leading-snug text-muted-foreground">
              This session is pinned to <span className="font-semibold text-foreground">{branch}</span>. Start a new
              session from the dashboard to work on a different branch.
            </div>
          </div>
        )}
      </div>

      {/* ── Connection indicator ──────────────────────────────────────── */}
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <span className={`w-2 h-2 rounded-full ${statusCfg.color}`} aria-hidden />
        {statusCfg.label}
      </span>

      {/* ── Spacer ────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Participant avatar row ────────────────────────────────────── */}
      {participants.length > 0 && (
        <div className="flex items-center -space-x-2 shrink-0">
          {visibleParticipants.map((p) => {
            const isSelf = p.uid === currentUserId
            const ringColor = p.color ?? '#52525b'
            return (
              <div
                key={p.uid}
                className="group relative"
                title={isSelf ? `${p.username} (you)` : p.username}
              >
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar}
                    alt={p.username}
                    className="h-7 w-7 rounded-full border-2 bg-muted object-cover"
                    style={{ borderColor: ringColor }}
                  />
                ) : (
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 bg-muted text-[10px] font-bold text-foreground"
                    style={{ borderColor: ringColor }}
                  >
                    {initialsOf(p.username)}
                  </div>
                )}
                <span
                  className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {isSelf ? `${p.username} (you)` : p.username}
                </span>
              </div>
            )
          })}
          {overflowCount > 0 && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-border bg-muted text-[10px] font-bold text-muted-foreground"
              title={`${overflowCount} more`}
            >
              +{overflowCount}
            </div>
          )}
        </div>
      )}

      {/* ── Leave session (visible to everyone) ───────────────────────── */}
      <button
        type="button"
        onClick={() => setLeaveConfirmOpen(true)}
        aria-label="Leave session"
        title="Leave session"
        className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground shrink-0"
      >
        <DoorOpen className="h-4 w-4" strokeWidth={2} aria-hidden />
        Leave
      </button>

      {/* ── Host menu ─────────────────────────────────────────────────── */}
      {isHost && onEndSession && (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Host menu"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              menuOpen && 'bg-accent text-foreground',
            )}
          >
            <MoreVertical className="h-4 w-4" strokeWidth={2} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg bg-popover shadow-[0_0_0_1px_rgba(16,185,129,0.35),_0_0_20px_rgba(16,185,129,0.2),_0_0_50px_rgba(16,185,129,0.12)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  setEndConfirmOpen(true)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <PowerOff className="h-4 w-4" strokeWidth={2} />
                End session for everyone
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Themed confirm dialogs ────────────────────────────────────── */}
      <ConfirmDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        title="Leave this session?"
        description="You'll disconnect from the live editor and return to your dashboard. Other people in the session will keep working."
        confirmLabel="Leave session"
        cancelLabel="Stay"
        variant="default"
        onConfirm={() => {
          setLeaveConfirmOpen(false)
          window.location.href = '/dashboard'
        }}
      />

      <ConfirmDialog
        open={endConfirmOpen}
        onOpenChange={setEndConfirmOpen}
        title="End this session for everyone?"
        description="All participants will be disconnected from the live editor. The saved draft is kept — you can still commit & push from the dashboard later."
        helperText="This action cannot be undone. Participants will see a toast and be redirected to their dashboards."
        confirmLabel="End session"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => {
          setEndConfirmOpen(false)
          onEndSession?.()
        }}
      />
    </header>
  )
}
