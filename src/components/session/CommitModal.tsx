'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useEditorStore } from '@/store/editorStore'

interface CommitModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

export function CommitModal({ isOpen, onClose, sessionId }: CommitModalProps) {
  const [message, setMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const getDirtyFiles = useEditorStore((s) => s.getDirtyFiles)
  const markDirty = useEditorStore((s) => s.markDirty)
  const dirtyFiles = getDirtyFiles()

  const handleCommit = useCallback(async () => {
    if (!message.trim()) {
      setError('Please enter a commit message')
      return
    }

    if (dirtyFiles.length === 0) {
      setError('No changed files to commit')
      return
    }

    setIsCommitting(true)
    setError(null)

    try {
      // Build the commit payload per TDD CommitPayload type
      const payload = {
        sessionId,
        message: message.trim(),
        files: dirtyFiles.map((f) => ({
          path: f.path,
          content: f.content,
          sha: f.originalSha,
        })),
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

      // Mark all committed files as clean
      dirtyFiles.forEach((f) => markDirty(f.path, false))

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
  }, [message, dirtyFiles, sessionId, markDirty, onClose])

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
                return (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border-b last:border-b-0 border-[var(--foreground)]/5"
                  >
                    <span className="text-orange-400 text-xs">M</span>
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isCommitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCommit}
            loading={isCommitting}
            disabled={dirtyFiles.length === 0 || !message.trim()}
          >
            {isCommitting ? 'Committing...' : 'Commit & Push'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
