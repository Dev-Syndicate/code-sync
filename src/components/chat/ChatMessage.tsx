'use client'

import type { ChatMessage as ChatMessageType } from '@/types/chat'

interface Props {
  message:       ChatMessageType
  isOwnMessage:  boolean
}

function formatTime(ts: ChatMessageType['timestamp']): string {
  if (!ts) return ''
  // Firestore Timestamp has .toDate(), plain Date objects also work
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts as unknown as number)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatMessage({ message, isOwnMessage }: Props) {
  // ── System event messages ──────────────────────────────────────────────────
  if (message.type === 'system') {
    return (
      <div className="flex items-center justify-center py-1">
        <span
          style={{
            fontSize:   'var(--text-xs)',
            color:      'var(--text-muted)',
            fontStyle:  'italic',
          }}
        >
          {message.message}
        </span>
      </div>
    )
  }

  // ── Regular user messages ──────────────────────────────────────────────────
  return (
    <div
      className={`flex items-start gap-2 px-3 py-1.5 ${
        isOwnMessage ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Bubble */}
      <div
        style={{
          maxWidth: '75%',
          display:  'flex',
          flexDirection: 'column',
          alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
          gap: '2px',
        }}
      >
        {/* Username + timestamp */}
        {!isOwnMessage && (
          <span
            style={{
              fontSize:    'var(--text-xs)',
              color:       'var(--text-muted)',
              paddingLeft: '2px',
            }}
          >
            {message.username}
          </span>
        )}

        <div
          style={{
            background:   isOwnMessage ? 'var(--color-primary)' : 'var(--bg-elevated)',
            color:        'var(--text-primary)',
            borderRadius: isOwnMessage
              ? 'var(--radius-lg) var(--radius-sm) var(--radius-lg) var(--radius-lg)'
              : 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
            padding:      '6px 10px',
            fontSize:     'var(--text-sm)',
            lineHeight:   '1.4',
            wordBreak:    'break-word',
          }}
        >
          {message.message}
        </div>

        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
