'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/legacy/Modal'
import { Button } from '@/components/ui/legacy/Button'

interface ShareLinkProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  participantCount: number
}

export function ShareLink({
  isOpen,
  onClose,
  sessionId,
  participantCount,
}: ShareLinkProps) {
  const [copied, setCopied] = useState(false)

  const sessionUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/session/${sessionId}`
      : ''

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = sessionUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [sessionUrl])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Session">
      <div className="space-y-4">
        {/* Session link */}
        <div>
          <label className="block text-xs font-medium text-[var(--foreground)]/60 mb-1.5">
            Session Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={sessionUrl}
              readOnly
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--foreground)]/5 border border-[var(--foreground)]/10 text-sm text-[var(--foreground)] font-mono"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              variant={copied ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleCopy}
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </Button>
          </div>
        </div>

        {/* Session info */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-[var(--foreground)]/5 text-sm">
          <div>
            <span className="text-[var(--foreground)]/50">Session ID: </span>
            <span className="font-mono text-xs">{sessionId.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-[var(--foreground)]/50">Participants: </span>
            <span>{participantCount}</span>
          </div>
        </div>

        {/* Info text */}
        <p className="text-xs text-[var(--foreground)]/40">
          Share this link with team members. They&apos;ll need to be logged in to join the session.
        </p>
      </div>
    </Modal>
  )
}
