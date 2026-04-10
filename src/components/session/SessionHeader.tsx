'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/legacy/Button'
import { ShareLink } from '@/components/session/ShareLink'
import { CommitModal } from '@/components/session/CommitModal'
import type { ConnectionStatus } from '@/hooks/useConnectionStatus'

interface SessionHeaderProps {
  sessionId: string
  connectionStatus: ConnectionStatus
  participantCount: number
  repoName?: string
  branch?: string
  isOwner?: boolean
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
  isOwner = true,
}: SessionHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCommitModal, setShowCommitModal] = useState(false)

  const statusCfg = STATUS_CONFIG[connectionStatus]

  return (
    <>
      <header className="flex items-center justify-between px-4 h-12 bg-[#333333] border-b border-white/10 shrink-0">
        {/* Left — Repo info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <h1 className="text-sm font-semibold text-white truncate max-w-48">
              {repoName}
            </h1>
          </div>

          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
            {branch}
          </span>

          {/* Connection dot */}
          <span className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={`w-2 h-2 rounded-full ${statusCfg.color}`} />
            {statusCfg.label}
          </span>

          {/* Participant count */}
          <span className="flex items-center gap-1 text-xs text-white/40">
            👥 {participantCount}
          </span>
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShareModal(true)}
          >
            🔗 Share
          </Button>

          {isOwner && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCommitModal(true)}
            >
              💾 Commit & Push
            </Button>
          )}

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
            🚪 Leave
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
    </>
  )
}
