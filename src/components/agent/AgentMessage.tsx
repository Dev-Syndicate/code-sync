'use client'

import type * as Y from 'yjs'
import type { AgentMessage as AgentMessageType } from '@/types/agent'
import { useAgentStore } from '@/store/agentStore'
import { ProposalCard } from './ProposalCard'

interface Props {
  message: AgentMessageType
  ydoc: Y.Doc | null
  onAccept: (proposalId: string) => void
  onReject: (proposalId: string) => void
}

export function AgentMessage({
  message,
  ydoc,
  onAccept,
  onReject,
}: Props) {
  const isUser = message.role === 'user'

  // Subscribe to the proposal map so status updates re-render this message.
  const proposalsById = useAgentStore((s) => s.pendingProposals)

  return (
    <div
      style={{
        padding: 'var(--space-2) var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: isUser ? 'var(--text-muted)' : 'var(--accent, #6366f1)',
          fontWeight: 600,
        }}
      >
        {isUser ? 'You' : 'AI Agent'}
      </div>
      <div
        style={{
          color: 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.text || (
          message.role === 'assistant' && message.status === 'streaming' ? (
            <span style={{ color: 'var(--text-muted)' }}>…thinking</span>
          ) : null
        )}
      </div>

      {message.role === 'assistant' &&
        message.proposalIds.map((pid) => {
          const p = proposalsById[pid]
          if (!p) return null
          return (
            <ProposalCard
              key={pid}
              proposal={p}
              ydoc={ydoc}
              onAccept={onAccept}
              onReject={onReject}
            />
          )
        })}

      {message.role === 'assistant' && message.status === 'error' && (
        <div
          style={{
            marginTop: 'var(--space-1)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 'var(--radius-md, 6px)',
            color: '#f87171',
            fontSize: 'var(--text-xs)',
          }}
        >
          {message.errorMessage ?? 'Something went wrong.'}
        </div>
      )}
    </div>
  )
}
