'use client'

import { useEffect, useRef } from 'react'
import type * as Y from 'yjs'
import { useAgentChat } from '@/hooks/useAgentChat'
import { AgentMessage } from './AgentMessage'
import { AgentInput } from './AgentInput'

interface Props {
  sessionId: string
  ydoc: Y.Doc | null
}

export function AgentPanel({ sessionId, ydoc }: Props) {
  const { messages, isStreaming, error, send, stop, accept, reject } =
    useAgentChat({ sessionId, ydoc })

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        background: 'var(--bg-surface)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          AI Agent
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          {isStreaming ? 'streaming…' : 'private to you'}
        </span>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 'var(--space-2)',
          paddingBottom: 'var(--space-2)',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 'var(--space-2)',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-4)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontWeight: 600 }}>Ask your AI coding agent</span>
            <span style={{ fontSize: 'var(--text-xs)' }}>
              It can see your open tabs and propose edits. Accepted edits
              are shared with everyone in the session.
            </span>
          </div>
        ) : (
          messages.map((m) => (
            <AgentMessage
              key={m.id}
              message={m}
              ydoc={ydoc}
              onAccept={accept}
              onReject={reject}
            />
          ))
        )}
        {error && messages.length > 0 && (
          <div
            style={{
              margin: 'var(--space-2) var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 'var(--radius-md, 6px)',
              color: '#f87171',
              fontSize: 'var(--text-xs)',
            }}
          >
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────── */}
      <AgentInput
        onSend={send}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!ydoc}
      />
    </div>
  )
}
