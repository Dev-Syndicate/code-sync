'use client'

import { useState } from 'react'
import {
  DoorOpen,
  Files,
  GitBranch,
  History,
  PowerOff,
  Save,
  Share2,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShareLink } from '@/components/session/ShareLink'
import { CommitModal } from '@/components/session/CommitModal'
import {
  CommitHistoryModal,
  type RevertedFile,
} from '@/components/session/CommitHistoryModal'

interface ActivityBarProps {
  sessionId: string
  participantCount: number
  /** Whether the file tree panel is currently visible. */
  filesOpen: boolean
  /** Toggle the file tree panel. */
  onToggleFiles: () => void
  onSave?: () => void
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  hasDirtyFiles?: boolean
  onRevertSave?: () => void
  revertStatus?: 'idle' | 'loading' | 'success' | 'error'
  onCommitReverted?: (affectedFiles: RevertedFile[]) => void
  /** True when the current user owns the session. Unlocks "End session". */
  isHost?: boolean
}

interface ActivityItemProps {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  primary?: boolean
  danger?: boolean
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

function ActivityItem({
  label,
  onClick,
  disabled,
  active,
  primary,
  danger,
  icon: Icon,
}: ActivityItemProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'relative flex h-11 w-11 items-center justify-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          disabled && 'opacity-40 cursor-not-allowed',
          !disabled && !primary && !danger && 'text-muted-foreground hover:text-foreground',
          !disabled && primary && 'text-primary hover:text-primary/80',
          !disabled && danger && 'text-destructive hover:text-destructive/80',
          active && 'text-foreground',
        )}
      >
        {/* Active indicator bar (left edge, VS Code style) */}
        {active && (
          <span
            className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-primary"
            aria-hidden
          />
        )}
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>

      {/* Tooltip */}
      <span
        className={cn(
          'pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap',
          'rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md',
          'opacity-0 group-hover:opacity-100 transition-opacity delay-100'
        )}
      >
        {label}
      </span>
    </div>
  )
}

export function ActivityBar({
  sessionId,
  participantCount,
  filesOpen,
  onToggleFiles,
  onSave,
  saveStatus = 'idle',
  hasDirtyFiles = false,
  onRevertSave,
  revertStatus = 'idle',
  onCommitReverted,
  isHost = false,
}: ActivityBarProps) {
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [endingSession, setEndingSession] = useState(false)

  const handleRevertSaveClick = () => {
    if (!onRevertSave) return
    const ok = confirm(
      'Revert to last saved draft?\n\nEvery open file will snap back to its last Save. Unsaved keystrokes on those files will be lost. This change is shared with everyone in the session.',
    )
    if (ok) onRevertSave()
  }

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave this session?')) {
      window.location.href = '/dashboard'
    }
  }

  const handleEndSession = async () => {
    const ok = confirm(
      'End this session for everyone?\n\nAll participants will be disconnected. The saved draft is kept and you can still commit & push from the dashboard later.',
    )
    if (!ok) return
    setEndingSession(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        alert(body?.error?.message ?? `Failed to end session (${res.status})`)
        setEndingSession(false)
        return
      }
      // Don't redirect here — the Firestore listener in SessionPage will
      // pick up active:false and route everyone (host included) to
      // /dashboard so there's a single exit path.
    } catch (err) {
      console.error('[ActivityBar] end session failed:', err)
      alert('Failed to end session.')
      setEndingSession(false)
    }
  }

  return (
    <>
      <nav
        aria-label="Session actions"
        className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-card py-2"
      >
        {/* View toggle: file explorer */}
        <div className="flex flex-col items-center">
          <ActivityItem
            icon={Files}
            label={filesOpen ? 'Hide file explorer' : 'Show file explorer'}
            onClick={onToggleFiles}
            active={filesOpen}
          />
        </div>

        {/* Divider */}
        <div className="my-2 h-px w-6 bg-border" aria-hidden />

        {/* Top group: actions */}
        <div className="flex flex-col items-center">
          <ActivityItem
            icon={Share2}
            label="Share session"
            onClick={() => setShowShareModal(true)}
          />
          <ActivityItem
            icon={Save}
            label={
              saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'saved'
                  ? 'Saved!'
                  : 'Save draft'
            }
            disabled={!hasDirtyFiles || saveStatus === 'saving'}
            onClick={() => onSave?.()}
          />
          <ActivityItem
            icon={Undo2}
            label={revertStatus === 'loading' ? 'Reverting...' : 'Revert save'}
            disabled={!onRevertSave || revertStatus === 'loading'}
            onClick={handleRevertSaveClick}
          />
          <ActivityItem
            icon={History}
            label="Commit history"
            onClick={() => setShowHistoryModal(true)}
          />
          <ActivityItem
            icon={GitBranch}
            label="Commit & Push"
            primary
            onClick={() => setShowCommitModal(true)}
          />
        </div>

        {/* Bottom group: leave / end */}
        <div className="mt-auto flex flex-col items-center">
          {isHost && (
            <ActivityItem
              icon={PowerOff}
              label={endingSession ? 'Ending session...' : 'End session for everyone'}
              danger
              disabled={endingSession}
              onClick={handleEndSession}
            />
          )}
          <ActivityItem
            icon={DoorOpen}
            label="Leave session"
            onClick={handleLeave}
          />
        </div>
      </nav>

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
