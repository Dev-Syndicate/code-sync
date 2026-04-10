'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/legacy/Button'
import { ShareLink } from '@/components/session/ShareLink'
import { CommitModal } from '@/components/session/CommitModal'
import { CommitHistoryModal, type RevertedFile } from '@/components/session/CommitHistoryModal'
import type { ConnectionStatus } from '@/hooks/useConnectionStatus'

interface SessionHeaderProps {
  sessionId: string
  connectionStatus: ConnectionStatus
  participantCount: number
  repoName?: string
  branch?: string
  onSave?: () => void
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  hasDirtyFiles?: boolean
  /** Save Revert — rolls every open file back to its last saved draft. */
  onRevertSave?: () => void
  revertStatus?: 'idle' | 'loading' | 'success' | 'error'
  /** Called after a commit revert succeeds so the parent can hard-reset Y.Texts. */
  onCommitReverted?: (affectedFiles: RevertedFile[]) => void
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; label: string }
> = {
  connected: { color: 'bg-green-500', label: 'Live' },
  connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Connecting' },
  disconnected: { color: 'bg-red-500', label: 'Offline' },
}

export function SessionHeader({
  sessionId,
  connectionStatus,
  participantCount,
  repoName = 'Repository',
  branch = 'main',
  onSave,
  saveStatus = 'idle',
  hasDirtyFiles = false,
  onRevertSave,
  revertStatus = 'idle',
  onCommitReverted,
}: SessionHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const handleRevertSaveClick = () => {
    if (!onRevertSave) return
    const ok = confirm(
      'Revert to last saved draft?\n\nEvery open file will snap back to its last Save. Unsaved keystrokes on those files will be lost. This change is shared with everyone in the session.',
    )
    if (ok) onRevertSave()
  }

  const statusCfg = STATUS_CONFIG[connectionStatus]

  return (
    <>
      <header className="flex items-center justify-between px-4 h-12 bg-card border-b border-border shrink-0">
        {/* Left — Repo info */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground truncate max-w-48">
            {repoName}
          </h1>

          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {branch}
          </span>

          {/* Connection dot */}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${statusCfg.color}`} />
            {statusCfg.label}
          </span>

          {/* Participant count */}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {participantCount} {participantCount === 1 ? 'user' : 'users'}
          </span>
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShareModal(true)}
          >
            Share
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={!hasDirtyFiles || saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevertSaveClick}
            disabled={!onRevertSave || revertStatus === 'loading'}
            title="Revert every open file to its last saved draft (shared with all peers)"
          >
            {revertStatus === 'loading' ? 'Reverting...' : 'Revert Save'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistoryModal(true)}
            title="Show commit history and revert past commits"
          >
            History
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCommitModal(true)}
          >
            Commit &amp; Push
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // TODO: Wire to presence.leaveSession() when implemented
              if (confirm('Are you sure you want to leave this session?')) {
                window.location.href = '/dashboard'
              }
            }}
          >
            Leave
          </Button>
        </div>
      </header>

      {/* Modals */}
      <ShareLink
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        sessionId={sessionId}
        participantCount={participantCount}
      />
      <CommitModal
        isOpen={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        sessionId={sessionId}
      />
      <CommitHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        sessionId={sessionId}
        onCommitReverted={onCommitReverted}
      />
    </>
  )
}
