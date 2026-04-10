'use client'

import {
  useState,
  useRef,
  type KeyboardEvent,
  type FormEvent,
} from 'react'

interface Props {
  onSend: (text: string) => Promise<void> | void
  onStop?: () => void
  disabled?: boolean
  isStreaming?: boolean
}

export function AgentInput({
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
}: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || disabled || isStreaming) return
    setText('')
    await onSend(trimmed)
    textareaRef.current?.focus()
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

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        borderTop: '1px solid var(--border-default)',
        padding: 'var(--space-3)',
        display: 'flex',
        gap: 'var(--space-2)',
        alignItems: 'flex-end',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={
          disabled
            ? 'AI Agent unavailable…'
            : 'Ask the AI about your code… (Shift+Enter for newline)'
        }
        rows={2}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--bg-input, var(--bg-surface))',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md, 6px)',
          padding: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          style={{
            background: 'var(--danger, #dc2626)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md, 6px)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          style={{
            background:
              disabled || !text.trim()
                ? 'var(--bg-muted, #374151)'
                : 'var(--accent, #6366f1)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md, 6px)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--text-sm)',
            cursor:
              disabled || !text.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      )}
    </form>
  )
}
