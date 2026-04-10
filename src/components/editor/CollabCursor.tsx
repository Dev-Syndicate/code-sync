'use client'

import { useEffect, useRef } from 'react'
import type { editor } from 'monaco-editor'
import type { RemoteCursor } from '@/types/editor'

interface CollabCursorProps {
  editor: editor.IStandaloneCodeEditor | null
  cursors: RemoteCursor[]
}

/**
 * Renders remote cursor decorations on the Monaco editor.
 * Each cursor gets a colored line decoration and a floating username label
 * that auto-hides after 3 seconds of inactivity.
 */
export function CollabCursor({ editor: editorInstance, cursors }: CollabCursorProps) {
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null)

  useEffect(() => {
    if (!editorInstance || cursors.length === 0) {
      // Clear existing decorations
      decorationsRef.current?.clear()
      return
    }

    const decorations: editor.IModelDeltaDecoration[] = cursors.map((cursor) => ({
      range: {
        startLineNumber: cursor.position.line,
        startColumn: cursor.position.column,
        endLineNumber: cursor.position.line,
        endColumn: cursor.position.column + 1,
      },
      options: {
        className: `remote-cursor-${cursor.userId}`,
        beforeContentClassName: `remote-cursor-line`,
        hoverMessage: { value: cursor.username },
        stickiness: 1, // NeverGrowsWhenTypingAtEdges
        after: {
          content: ` ${cursor.username}`,
          inlineClassName: 'remote-cursor-label',
        },
      },
    }))

    // Inject per-user cursor color styles
    injectCursorStyles(cursors)

    // Apply decorations
    if (decorationsRef.current) {
      decorationsRef.current.set(decorations)
    } else {
      decorationsRef.current = editorInstance.createDecorationsCollection(decorations)
    }

    return () => {
      decorationsRef.current?.clear()
      decorationsRef.current = null
    }
  }, [editorInstance, cursors])

  // This component renders nothing — it works via Monaco's decoration API
  return null
}

// ── Utility: inject dynamic CSS for cursor colors ──
const injectedUsers = new Set<string>()

function injectCursorStyles(cursors: RemoteCursor[]) {
  for (const cursor of cursors) {
    if (injectedUsers.has(cursor.userId)) continue
    injectedUsers.add(cursor.userId)

    const style = document.createElement('style')
    style.setAttribute('data-collab-cursor', cursor.userId)
    style.textContent = `
      .remote-cursor-${cursor.userId} {
        background-color: ${cursor.color}40 !important;
        border-left: 2px solid ${cursor.color} !important;
      }
      .remote-cursor-label {
        font-size: 11px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 3px;
        background-color: ${cursor.color};
        color: white;
        pointer-events: none;
        animation: cursor-fade 3s ease-in-out forwards;
      }
      @keyframes cursor-fade {
        0%, 70% { opacity: 1; }
        100% { opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }
}
