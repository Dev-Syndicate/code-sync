'use client'

import { useEffect, useRef } from 'react'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/hooks/useAuth'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'

interface Props {
  sessionId: string
}

export function ChatPanel({ sessionId }: Props) {
  const { user }                  = useAuth()
  const { messages, sendMessage, loading } = useChat(sessionId)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on every new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        background:    'var(--bg-surface)',
        borderLeft:    '1px solid var(--border-default)',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding:       'var(--space-3) var(--space-4)',
          borderBottom:  '1px solid var(--border-default)',
          display:       'flex',
          alignItems:    'center',
          gap:           'var(--space-2)',
          flexShrink:    0,
        }}
      >
        <span style={{ fontSize: '14px' }}>💬</span>
        <span
          style={{
            fontSize:   'var(--text-sm)',
            fontWeight: 600,
            color:      'var(--text-primary)',
          }}
        >
          Team Chat
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize:   'var(--text-xs)',
            color:      'var(--text-muted)',
          }}
        >
          {messages.filter((m) => m.type === 'message').length} messages
        </span>
      </div>

      {/* ── Messages list ─────────────────────────────────────────────────── */}
      <div
        style={{
          flex:       1,
          overflowY:  'auto',
          paddingTop: 'var(--space-2)',
          paddingBottom: 'var(--space-2)',
        }}
      >
        {loading ? (
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              height:         '100%',
              color:          'var(--text-muted)',
              fontSize:       'var(--text-sm)',
            }}
          >
            Loading chat…
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              height:         '100%',
              gap:            'var(--space-2)',
              color:          'var(--text-muted)',
              fontSize:       'var(--text-sm)',
            }}
          >
            <span style={{ fontSize: '24px' }}>💬</span>
            <span>No messages yet.</span>
            <span style={{ fontSize: 'var(--text-xs)' }}>Say hi to the team!</span>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isOwnMessage={msg.userId === user?.uid}
            />
          ))
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <ChatInput
        onSend={sendMessage}
        disabled={!user}
      />
    </div>
  )
}
