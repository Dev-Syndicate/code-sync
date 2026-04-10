'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Book, Loader2, Play } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { GitHubRepo } from '@/types'
import { createSession } from '@/lib/session/create'
import { useAuth } from '@/hooks/useAuth'
import { useSessionStore } from '@/store/sessionStore'

interface CreateSessionProps {
  repo: GitHubRepo
  isOpen: boolean
  onClose: () => void
}

export function CreateSession({ repo, isOpen, onClose }: CreateSessionProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { addSession } = useSessionStore()

  const [branch, setBranch] = useState(repo.default_branch)
  const [maxParticipants, setMaxParticipants] = useState(4)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Branches ─────────────────────────────────────────────────────────
  // Fetched from GET /api/repos?owner=X&repo=Y&branches=1 each time the
  // modal opens. Before the fetch completes (or if it fails) we still
  // want the picker to show at least the repo's default branch so the
  // user can create a session — the dropdown degrades gracefully.
  const [branches, setBranches] = useState<string[]>([repo.default_branch])
  const [branchesLoading, setBranchesLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const ac = new AbortController()

    setBranchesLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/repos?owner=${encodeURIComponent(repo.owner.login)}&repo=${encodeURIComponent(repo.name)}&branches=1`,
          {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin',
            signal: ac.signal,
          },
        )
        if (cancelled) return
        if (!res.ok) {
          // Leave the fallback (default branch) in place.
          return
        }
        const json = await res.json()
        if (!json?.success || !Array.isArray(json.data)) return
        const names = (json.data as Array<{ name: string }>).map((b) => b.name)
        // Put the default branch first; stable-sort the rest alphabetically.
        const rest = names.filter((n) => n !== repo.default_branch).sort()
        const ordered = [repo.default_branch, ...rest]
        if (!cancelled) setBranches(ordered)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[CreateSession] fetch branches failed:', err)
      } finally {
        if (!cancelled) setBranchesLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [isOpen, repo.owner.login, repo.name, repo.default_branch])

  async function handleCreate() {
    setIsCreating(true)
    setError(null)

    try {
      const session = await createSession({
        repo: repo.name,
        repoOwner: repo.owner.login,
        repoUrl: repo.html_url,
        branch,
        owner: user?.uid ?? 'mock-user-id',
        files: [],
        maxParticipants,
      })

      if (session) {
        addSession(session)
        onClose()
        router.push(`/session/${session.id}`)
      } else {
        setError('Failed to create session. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isCreating && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Coding Session</DialogTitle>
          <DialogDescription>
            Start a new collaborative session for this repository.
          </DialogDescription>
        </DialogHeader>

        {/* Repo info card */}
        <Card className="flex items-center gap-3 p-3.5 px-4 bg-background/60">
          <Book className="h-5 w-5 shrink-0 text-[var(--color-brand-mint)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {repo.owner.login}/{repo.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {repo.description || 'No description'}
            </p>
          </div>
        </Card>

        {/* Branch */}
        <div className="space-y-2">
          <Label htmlFor="branch-select" className="flex items-center gap-2">
            Branch
            {branchesLoading && (
              <Loader2
                className="h-3 w-3 animate-spin text-muted-foreground"
                aria-label="Loading branches"
              />
            )}
          </Label>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger id="branch-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Max Participants */}
        <div className="space-y-2">
          <Label>Max Participants</Label>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxParticipants(n)}
                aria-pressed={maxParticipants === n}
                className={cn(
                  'flex-1 rounded-md py-2.5 text-sm font-semibold transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  maxParticipants === n
                    ? 'border-2 border-primary bg-primary/15 text-[var(--color-brand-mint)]'
                    : 'border border-border bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="gap-1.5 sm:flex-[2]"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" aria-hidden />
                Start Session
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
