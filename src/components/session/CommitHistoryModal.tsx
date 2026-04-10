'use client'

import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface CommitHistoryModalProps {
  isOpen:   boolean
  onClose:  () => void
  sessionId: string
  /**
   * Called after a successful revert. Receives each file the revert touched
   * with its new post-revert content, so the parent (SessionPage) can hard-
   * reset those files' Y.Texts collaboratively.
   */
  onCommitReverted?: (affectedFiles: RevertedFile[]) => void
}

interface CommitSummary {
  sha:          string
  message:      string
  author:       { name: string; email: string; date: string }
  authorLogin:  string | null
  authorAvatar: string | null
  parents:      string[]
}

export interface RevertedFile {
  path:      string
  operation: 'modify' | 'delete' | 'create'
  content:   string | null
}

function formatRelativeTime(iso: string): string {
  const delta = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`
  return `${Math.floor(delta / 86400)}d ago`
}

function headline(message: string): string {
  // Only show the first line in the list — the full message often has a
  // body, co-author trailers, or "This reverts commit …" and we want the
  // row to stay scannable.
  const nl = message.indexOf('\n')
  return nl === -1 ? message : message.slice(0, nl)
}

export function CommitHistoryModal({
  isOpen,
  onClose,
  sessionId,
  onCommitReverted,
}: CommitHistoryModalProps) {
  const [commits,     setCommits]     = useState<CommitSummary[]>([])
  const [loading,     setLoading]     = useState(false)
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [revertingSha, setRevertingSha] = useState<string | null>(null)
  const [revertError, setRevertError] = useState<string | null>(null)
  const [successMsg,  setSuccessMsg]  = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(
        `/api/commits?sessionId=${encodeURIComponent(sessionId)}`,
        { cache: 'no-store', credentials: 'same-origin' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Failed to load history (${res.status})`)
      }
      const json = await res.json()
      setCommits(json?.data?.commits ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // Load (and reload) whenever the modal opens.
  useEffect(() => {
    if (isOpen) {
      setSuccessMsg(null)
      setRevertError(null)
      void loadHistory()
    }
  }, [isOpen, loadHistory])

  const handleRevert = useCallback(
    async (sha: string) => {
      const shortSha = sha.slice(0, 7)
      const ok = confirm(
        `Revert commit ${shortSha}?\n\nThis creates a NEW commit that undoes those changes. No force-push, no history rewrite. If later commits have modified the same files, the revert will be refused.\n\nOpen files touched by the revert will snap back to their new content for every peer in the session. Unsaved keystrokes on those files will be lost.`,
      )
      if (!ok) return

      setRevertingSha(sha)
      setRevertError(null)
      setSuccessMsg(null)

      try {
        const res = await fetch('/api/commits/revert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ sessionId, commitSha: sha }),
        })

        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          const code = json?.error?.code
          const msg  = json?.error?.message ?? `Revert failed (${res.status})`
          setRevertError(code === 'REVERT_CONFLICT' ? msg : `Revert failed: ${msg}`)
          return
        }

        const affected: RevertedFile[] = json.data.affectedFiles ?? []
        onCommitReverted?.(affected)
        setSuccessMsg(
          `Reverted ${shortSha} — new commit ${json.data.commitSha.slice(0, 7)} pushed. ${affected.length} file(s) updated.`,
        )
        // Refresh the list so the new inverse commit shows at the top.
        void loadHistory()
      } catch (err) {
        setRevertError(err instanceof Error ? err.message : 'Revert failed.')
      } finally {
        setRevertingSha(null)
      }
    },
    [sessionId, loadHistory, onCommitReverted],
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Commit History"
      className="max-w-2xl"
    >
      <div className="space-y-3">
        {loading && (
          <div className="text-sm text-[var(--foreground)]/50 py-4 text-center">
            Loading history...
          </div>
        )}

        {loadError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {loadError}
          </div>
        )}

        {revertError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {revertError}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            {successMsg}
          </div>
        )}

        {!loading && !loadError && commits.length === 0 && (
          <div className="text-sm text-[var(--foreground)]/50 py-6 text-center">
            No commits found on this branch.
          </div>
        )}

        {commits.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-[var(--foreground)]/10 divide-y divide-[var(--foreground)]/5">
            {commits.map((c) => {
              const isReverting = revertingSha === c.sha
              const isMerge     = c.parents.length > 1
              return (
                <div
                  key={c.sha}
                  className="flex items-start gap-3 px-3 py-2.5 text-sm hover:bg-[var(--foreground)]/5"
                >
                  {c.authorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.authorAvatar}
                      alt={c.author.name}
                      className="w-8 h-8 rounded-full shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--foreground)]/10 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--foreground)] truncate">
                      {headline(c.message)}
                    </div>
                    <div className="text-xs text-[var(--foreground)]/50 mt-0.5">
                      {c.authorLogin ?? c.author.name} · {formatRelativeTime(c.author.date)} ·{' '}
                      <span className="font-mono">{c.sha.slice(0, 7)}</span>
                      {isMerge && <span className="ml-1.5 text-amber-400">(merge)</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevert(c.sha)}
                    disabled={isReverting || revertingSha !== null || isMerge}
                    title={
                      isMerge
                        ? 'Merge commits cannot be reverted from here.'
                        : 'Revert this commit (creates a new inverse commit)'
                    }
                  >
                    {isReverting ? 'Reverting...' : '↺ Revert'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
