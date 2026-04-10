'use client'

// Single-line inline input used by the Explorer for two things:
//   1. Renaming an existing file/folder (pre-filled with the current name).
//   2. Creating a new file/folder (pre-filled with a placeholder).
//
// Behavior:
//   - Auto-focus + select on mount.
//   - Enter → onCommit(trimmed). Empty value → onCancel.
//   - Escape or blur → onCancel.
//   - For file renames the selection is name-only (extension excluded),
//     matching VS Code.

import { useEffect, useRef } from 'react'

interface Props {
  initialValue: string
  /** Whether we're naming a file (so we can smart-select just the base name). */
  isFile: boolean
  depth: number
  onCommit: (value: string) => void
  onCancel: () => void
  /** Optional icon to render to the left (matches the TreeNode's icon column). */
  iconSlot?: React.ReactNode
}

export function TreeInlineInput({
  initialValue,
  isFile,
  depth,
  onCommit,
  onCancel,
  iconSlot,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Guard against onBlur firing after we've already committed from onKeyDown.
  const resolvedRef = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()

    // Select the base name (everything before the last dot) for files, so
    // "hello.py" rename starts with "hello" selected. For folders and
    // blank new-item inputs, select all.
    if (isFile && initialValue) {
      const dotIdx = initialValue.lastIndexOf('.')
      if (dotIdx > 0) {
        el.setSelectionRange(0, dotIdx)
        return
      }
    }
    el.select()
  }, [isFile, initialValue])

  const commit = () => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    const value = inputRef.current?.value.trim() ?? ''
    if (!value) {
      onCancel()
    } else {
      onCommit(value)
    }
  }

  const cancel = () => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    onCancel()
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        paddingLeft: depth * 14 + 6,
      }}
    >
      {iconSlot && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {iconSlot}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        defaultValue={initialValue}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        onBlur={commit}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'var(--bg-input, #1e1e1e)',
          color: 'var(--text-primary, #e4e4e7)',
          border: '1px solid var(--accent, #6366f1)',
          borderRadius: 3,
          padding: '1px 4px',
          fontSize: '13px',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </div>
  )
}
