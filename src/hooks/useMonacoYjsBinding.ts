'use client'

import { useEffect, useRef } from 'react'
import type { editor } from 'monaco-editor'
import type * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'

interface UseMonacoYjsBindingOptions {
  editor: editor.IStandaloneCodeEditor | null
  ydoc: Y.Doc | null
  provider: WebsocketProvider | null
  isReady: boolean
  activeFile: string | null
  /** Initial content to seed the Y.Text with if it's empty on first bind. */
  initialContent: string | undefined
  /** Called whenever the bound Y.Text changes, so the store can mirror it. */
  onContentChange?: (file: string, content: string) => void
}

/**
 * Binds the active Monaco editor instance to a per-file Y.Text so that edits
 * propagate peer-to-peer through the y-websocket provider.
 *
 * Why this hook exists:
 *
 * Before: Monaco was a controlled component driven by a Zustand `content`
 * string and `onChange`. Nothing touched Y.Doc, so edits never left the local
 * browser and remote peers couldn't see keystrokes or cursors.
 *
 * After: y-monaco's MonacoBinding owns the editor's text model for the active
 * file. Local edits are written into Y.Text, shipped over the websocket, and
 * applied on peers. Remote selections are rendered as decorations automatically
 * (y-monaco writes them into awareness under `state.selection`).
 *
 * We still mirror the bound content into the Zustand tab via `onContentChange`
 * so the existing save/draft/dirty flow keeps working unchanged.
 *
 * `initialContent` and `onContentChange` are captured via refs so the effect
 * does NOT re-run on every keystroke — it's keyed purely on the provider/file
 * identity. Re-running on content change would tear down and rebuild the
 * binding on every edit, which defeats the whole point.
 */
export function useMonacoYjsBinding({
  editor,
  ydoc,
  provider,
  isReady,
  activeFile,
  initialContent,
  onContentChange,
}: UseMonacoYjsBindingOptions): void {
  const initialContentRef = useRef(initialContent)
  const onContentChangeRef = useRef(onContentChange)

  // Keep refs current without triggering the binding effect to re-run.
  useEffect(() => {
    initialContentRef.current = initialContent
  }, [initialContent])
  useEffect(() => {
    onContentChangeRef.current = onContentChange
  }, [onContentChange])

  useEffect(() => {
    if (!editor || !ydoc || !provider || !isReady || !activeFile) return

    const model = editor.getModel()
    if (!model) return

    // One Y.Text per file, keyed the same way useCollaboration.getText keys it.
    const ytext = ydoc.getText(`file:${activeFile}`)

    let binding: { destroy: () => void } | null = null
    let cancelled = false

    // y-monaco imports monaco-editor statically, which breaks SSR. Dynamic
    // import keeps it client-only — same reason CodeEditor lazy-loads Monaco.
    void import('y-monaco').then(({ MonacoBinding }) => {
      if (cancelled) return

      // ── Seed the Y.Text with the GitHub-fetched content, once ──────────
      //
      // Seeding MUST happen before constructing MonacoBinding, otherwise
      // the binding first wipes the Monaco model to the (empty) ytext, then
      // streams the insert back in. That intermediate empty-model window
      // desyncs Monaco's internal line count from peers for a tick and can
      // manifest as remote-selection highlights landing on the wrong line.
      //
      // Double-seed race: two peers both opening the file concurrently can
      // each observe `ytext.length === 0` and both insert, duplicating the
      // content and producing an N-line drift between clients — which is
      // exactly the "selection on wrong line" bug this comment exists to
      // prevent. We gate the seed on a Y.Map flag (`file-init:<path>`):
      // concurrent `set` operations are idempotent in Yjs, and whichever
      // peer wins the `has()` check first inserts — the loser skips.
      // Even if both peers race past `has()` (possible within a single
      // microtask), the flag being in the SAME transaction as the insert
      // means a merged remote state will carry the flag, so on reconnect
      // we never re-seed.
      const initFlags = ydoc.getMap<boolean>('file-init')
      const flagKey = activeFile
      const seed = initialContentRef.current
      if (
        !initFlags.has(flagKey) &&
        ytext.length === 0 &&
        seed &&
        seed.length > 0
      ) {
        ydoc.transact(() => {
          // Re-check inside the transaction to narrow the race window.
          if (!initFlags.has(flagKey) && ytext.length === 0) {
            ytext.insert(0, seed)
            initFlags.set(flagKey, true)
          }
        })
      }

      binding = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        provider.awareness
      )
    })

    // Mirror Y.Text → Zustand tab content so save/draft/dirty flows keep
    // working. We listen to ytext directly (not monaco's onDidChangeContent)
    // so we capture remote edits too.
    const observer = () => {
      onContentChangeRef.current?.(activeFile, ytext.toString())
    }
    ytext.observe(observer)

    // ── Per-client cursor color injection ────────────────────────────────
    // y-monaco adds classes like `yRemoteSelection-<clientID>` and
    // `yRemoteSelectionHead-<clientID>` to its decorations. Without a per-
    // clientID rule, every peer shows in the default color from globals.css.
    // We read `user.color` and `user.username` from each remote awareness
    // state and write/update a <style> tag with the matching rules.
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-yjs-remote-cursors', '')
    document.head.appendChild(styleEl)

    const renderAwarenessStyles = () => {
      const rules: string[] = []
      provider.awareness.getStates().forEach((state, clientID) => {
        if (clientID === provider.awareness.clientID) return
        const user = (state as { user?: { color?: string; username?: string } }).user
        const color = user?.color ?? '#fa8100'
        const name = user?.username ?? ''
        rules.push(
          `.yRemoteSelection-${clientID} { background-color: ${color}40; }`,
          `.yRemoteSelectionHead-${clientID} { border-color: ${color}; }`,
          `.yRemoteSelectionHead-${clientID}::after { border-color: ${color}; }`,
        )
        if (name) {
          // Floating username label attached to the caret via ::before content.
          rules.push(
            `.yRemoteSelectionHead-${clientID}::before {
              content: '${name.replace(/'/g, "\\'")}';
              position: absolute;
              top: -1.3em;
              left: -2px;
              font-size: 11px;
              font-weight: 600;
              padding: 1px 6px;
              border-radius: 3px;
              background-color: ${color};
              color: white;
              white-space: nowrap;
              pointer-events: none;
              z-index: 10;
            }`,
          )
        }
      })
      styleEl.textContent = rules.join('\n')
    }
    renderAwarenessStyles()
    provider.awareness.on('change', renderAwarenessStyles)

    return () => {
      cancelled = true
      ytext.unobserve(observer)
      provider.awareness.off('change', renderAwarenessStyles)
      styleEl.remove()
      binding?.destroy()
    }
  }, [editor, ydoc, provider, isReady, activeFile])
}
