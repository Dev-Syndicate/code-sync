'use client'

import {
  useState, useRef, type KeyboardEvent, type FormEvent
} from 'react'

interface Props {
  onSend:   (text: string) => Promise<void>
  disabled?: boolean
}

export function ChatInput({ onSend, disabled = false }: Props) {
  const [text, setText]       = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef           = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || disabled) return

    setSending(true)
    setText('')
    try {
      await onSend(trimmed)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const isDisabled = disabled || sending || !text.trim()

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display:       'flex',
        alignItems:    'flex-end',
        gap:           'var(--space-2)',
        padding:       'var(--space-3)',
        borderTop:     '1px solid var(--border-default)',
        background:    'var(--bg-surface)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message... (Enter to send)"
        disabled={disabled || sending}
        rows={1}
        style={{
          flex:        1,
          resize:      'none',
          background:  'var(--bg-elevated)',
          color:       'var(--text-primary)',
          border:      '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding:     '8px 12px',
          fontSize:    'var(--text-sm)',
          lineHeight:  '1.4',
          outline:     'none',
          fontFamily:  'var(--font-sans)',
          maxHeight:   '120px',
          overflowY:   'auto',
          transition:  'border-color var(--transition-fast)',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--color-primary)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border-default)'
        }}
      />

      <button
        type="submit"
        disabled={isDisabled}
        style={{
          width:        '36px',
          height:       '36px',
          flexShrink:   0,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          background:   isDisabled ? 'var(--bg-elevated)' : 'var(--color-primary)',
          color:        isDisabled ? 'var(--text-muted)' : '#fff',
          border:       'none',
          borderRadius: 'var(--radius-md)',
          cursor:       isDisabled ? 'not-allowed' : 'pointer',
          transition:   'background var(--transition-fast)',
          fontSize:     '16px',
        }}
        title="Send message"
      >
        {sending ? (
          // Minimal spinner
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
            ↻
          </span>
        ) : (
          '↑'
        )}
      </button>
    </form>
  )
}
