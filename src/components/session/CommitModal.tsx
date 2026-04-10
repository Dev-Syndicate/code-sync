'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/legacy/Modal'
import { Button } from '@/components/ui/legacy/Button'
import { useEditorStore } from '@/store/editorStore'

interface CommitModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

// Describes a file whose local originalSha disagrees with GitHub's current
// blob SHA — i.e. someone else has changed it since the user started
// editing. Committing would overwrite that change.
interface ConflictEntry {
  path: string
  /** null means the file was deleted on GitHub. */
  remoteSha: string | null
  localSha: string
}

export function CommitModal({ isOpen, onClose, sessionId }: CommitModalProps) {
  const [message, setMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictEntry[] | null>(null)

  const getDirtyFiles = useEditorStore((s) => s.getDirtyFiles)
  const markDirty = useEditorStore((s) => s.markDirty)
  const pendingDeletes = useEditorStore((s) => s.pendingDeletes)
  const clearPendingDeletes = useEditorStore((s) => s.clearPendingDeletes)
  const dirtyFiles = getDirtyFiles()

  const nothingToCommit =
    dirtyFiles.length === 0 && pendingDeletes.length === 0

  const handleCommit = useCallback(
    async (forceOverwrite = false) => {
      if (!message.trim()) {
        setError('Please enter a commit message')
        return
      }

      if (nothingToCommit) {
        setError('No changes to commit')
        return
      }

      setIsCommitting(true)
      setError(null)
      // Clear any previous conflict list unless we're explicitly
      // bypassing the check.
      if (!forceOverwrite) setConflicts(null)

      try {
        // ── Pre-commit conflict check ────────────────────────────
        // Ask the server for the current GitHub blob SHA of every
        // dirty file that has a local originalSha. Locally-new files
        // (originalSha === null) are skipped — there's nothing to
        // compare against. If any remote SHA differs from the local
        // originalSha, we have a lost-update risk: someone committed
        // to the same path since the user started editing.
        //
        // Deletions are NOT checked: if the user wants to delete a
        // file someone else just modified, that's still a legitimate
        // delete — we let GitHub's Git Tree API handle the merge.
        if (!forceOverwrite) {
          const pathsToCheck = dirtyFiles
            .filter((f) => !!f.originalSha)
            .map((f) => f.path)

          if (pathsToCheck.length > 0) {
            const checkRes = await fetch(
              `/api/sessions/${sessionId}/check-shas`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ paths: pathsToCheck }),
              }
            )
            if (checkRes.ok) {
              const checkJson = await checkRes.json()
              const remoteShas: Record<string, string | null> =
                checkJson?.data?.shas ?? {}

              const detected: ConflictEntry[] = []
              for (const f of dirtyFiles) {
                if (!f.originalSha) continue
                const remote = remoteShas[f.path]
                if (remote === undefined) continue // not in response
                if (remote !== f.originalSha) {
                  detected.push({
                    path: f.path,
                    remoteSha: remote,
                    localSha: f.originalSha,
                  })
                }
              }

              if (detected.length > 0) {
                // Stop here and render the conflict panel. The user
                // will click "Overwrite anyway" to come back with
                // forceOverwrite=true, or Cancel to back out.
                setConflicts(detected)
                setIsCommitting(false)
                return
              }
            }
            // If the check itself fails, fall through and commit anyway
            // — we'd rather push the user's work than block on a
            // transient network error for the safety check.
          }
        }

        // Build the commit payload per TDD CommitPayload type.
        // `sha` is optional in the server contract: files created
        // locally in the Explorer have originalSha === null, and the
        // commit route passes them to GitHub's Git Tree API as
        // brand-new blobs. `deletes` is the list of paths to remove
        // from the repo in this commit — each becomes a `sha: null`
        // tree entry server-side.
        const payload = {
          sessionId,
          message: message.trim(),
          files: dirtyFiles.map((f) => ({
            path: f.path,
            content: f.content,
            ...(f.originalSha ? { sha: f.originalSha } : {}),
          })),
          deletes: pendingDeletes,
        }

        // Call Dev 4's commit API endpoint
        const response = await fetch('/api/commits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error ?? 'Commit failed')
        }

        // Mark all committed files as clean, clear pending deletes,
        // clear any conflict state.
        dirtyFiles.forEach((f) => markDirty(f.path, false))
        clearPendingDeletes()
        setConflicts(null)

        setSuccess(true)
        setMessage('')

        // Auto-close after success
        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 1500)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to commit')
      } finally {
        setIsCommitting(false)
      }
    },
    [
      message,
      dirtyFiles,
      pendingDeletes,
      sessionId,
      markDirty,
      clearPendingDeletes,
      onClose,
      nothingToCommit,
    ]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Commit & Push">
      <div className="space-y-4">
        {/* Success message */}
        {success && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            ✅ Changes committed and pushed successfully!
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Changed files list */}
        <div>
          <label className="block text-xs font-medium text-[var(--foreground)]/60 mb-1.5">
            Changed Files ({dirtyFiles.length})
          </label>

          {dirtyFiles.length === 0 ? (
            <p className="text-sm text-[var(--foreground)]/40 py-2">
              No files have been modified
            </p>
          ) : (
            <div className="max-h-36 overflow-y-auto rounded-lg border border-[var(--foreground)]/10">
              {dirtyFiles.map((file) => {
                const name = file.path.split('/').pop() ?? file.path
                const isNewFile = file.originalSha === null
                return (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border-b last:border-b-0 border-[var(--foreground)]/5"
                  >
                    <span
                      className={`text-xs ${
                        isNewFile ? 'text-emerald-400' : 'text-orange-400'
                      }`}
                      title={isNewFile ? 'Added' : 'Modified'}
                    >
                      {isNewFile ? 'A' : 'M'}
                    </span>
                    <span className="text-[var(--foreground)]/70 truncate font-mono text-xs">
                      {name}
                    </span>
                    <span className="ml-auto text-[10px] text-[var(--foreground)]/30">
                      {file.language}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Deleted files list */}
        {pendingDeletes.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-red-400/80 mb-1.5">
              Deleted Files ({pendingDeletes.length})
            </label>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/5">
              {pendingDeletes.map((path) => {
                const name = path.split('/').pop() ?? path
                return (
                  <div
                    key={path}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border-b last:border-b-0 border-red-500/10"
                  >
                    <span className="text-red-400 text-xs" title="Deleted">
                      D
                    </span>
                    <span
                      className="text-red-300/80 truncate font-mono text-xs line-through"
                      title={path}
                    >
                      {name}
                    </span>
                    <span className="ml-auto text-[10px] text-red-400/40 truncate font-mono">
                      {path}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pre-commit conflict warning */}
        {conflicts && conflicts.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-sm mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-300">
                  {conflicts.length === 1
                    ? '1 file has changed on GitHub since you started editing'
                    : `${conflicts.length} files have changed on GitHub since you started editing`}
                </p>
                <p className="text-xs text-amber-200/70 mt-1">
                  Committing will overwrite the newer version
                  {conflicts.length === 1 ? '.' : 's.'} Click Refresh in
                  the Explorer to see the remote changes first, or
                  overwrite them anyway.
                </p>
              </div>
            </div>
            <div className="max-h-28 overflow-y-auto rounded border border-amber-500/20 bg-amber-500/5">
              {conflicts.map((c) => {
                const name = c.path.split('/').pop() ?? c.path
                const deletedUpstream = c.remoteSha === null
                return (
                  <div
                    key={c.path}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs border-b last:border-b-0 border-amber-500/10"
                  >
                    <span className="text-amber-400">
                      {deletedUpstream ? '!' : '≠'}
                    </span>
                    <span
                      className="text-amber-200/90 truncate font-mono"
                      title={c.path}
                    >
                      {name}
                    </span>
                    <span className="ml-auto text-[10px] text-amber-300/50 font-mono">
                      {deletedUpstream ? 'deleted on GitHub' : 'remote changed'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConflicts(null)}
                disabled={isCommitting}
              >
                Review first
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleCommit(true)}
                loading={isCommitting}
              >
                Overwrite anyway
              </Button>
            </div>
          </div>
        )}

        {/* Commit message */}
        <div>
          <label className="block text-xs font-medium text-[var(--foreground)]/60 mb-1.5">
            Commit Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your changes..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-[var(--foreground)]/5 border border-[var(--foreground)]/10 text-sm text-[var(--foreground)] resize-none placeholder:text-[var(--foreground)]/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            disabled={isCommitting}
          />
        </div>

        {/* Actions — hidden while the conflict panel is showing its own
            action row so there aren't two competing "Commit" buttons. */}
        {!conflicts && (
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isCommitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleCommit(false)}
              loading={isCommitting}
              disabled={nothingToCommit || !message.trim()}
            >
              {isCommitting ? 'Committing...' : 'Commit & Push'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
