'use client'

// useAgentChat
// ─────────────
// Client hook that drives the per-user AI agent chat for a session. It:
//
//   - Gathers open-file context from editorStore + the live Y.Doc.
//   - POSTs to /api/sessions/[id]/agent.
//   - Reads the SSE stream (via fetch + getReader, not EventSource, because
//     we need POST).
//   - Dispatches text_delta / edit_proposal / done / error events into
//     agentStore so the UI updates in real time.
//   - Exposes accept(proposalId) and reject(proposalId). accept applies the
//     edit through ydoc.transact() so every peer sees it live — the rest of
//     the conversation stays private to this browser.

import { useCallback, useRef } from 'react'
import type * as Y from 'yjs'
import { useAgentStore } from '@/store/agentStore'
import { useEditorStore } from '@/store/editorStore'
import { lineColToOffset } from '@/lib/gemini/proposals'
import type {
  AgentMessage,
  AgentOpenFile,
  EditProposal,
} from '@/types/agent'

interface UseAgentChatOptions {
  sessionId: string
  ydoc: Y.Doc | null
}

interface UseAgentChatReturn {
  messages: AgentMessage[]
  isStreaming: boolean
  error: string | null
  send: (text: string) => Promise<void>
  stop: () => void
  accept: (proposalId: string) => void
  reject: (proposalId: string) => void
}

// ── SSE frame parser ──────────────────────────────────────────────────────
interface SseFrame {
  event: string
  data: string
}

function parseSseBuffer(buffer: string): {
  frames: SseFrame[]
  rest: string
} {
  const frames: SseFrame[] = []
  let rest = buffer
  // Frames are delimited by a blank line (\n\n).
  let delimIdx = rest.indexOf('\n\n')
  while (delimIdx !== -1) {
    const raw = rest.slice(0, delimIdx)
    rest = rest.slice(delimIdx + 2)
    let event = 'message'
    const dataLines: string[] = []
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
    frames.push({ event, data: dataLines.join('\n') })
    delimIdx = rest.indexOf('\n\n')
  }
  return { frames, rest }
}

export function useAgentChat(
  options: UseAgentChatOptions
): UseAgentChatReturn {
  const { sessionId, ydoc } = options

  const messages = useAgentStore(
    (s) => s.conversations[sessionId] ?? EMPTY_MESSAGES
  )
  const streamingMessageId = useAgentStore((s) => s.streamingMessageId)
  const error = useAgentStore((s) => s.error[sessionId] ?? null)

  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (!ydoc) {
        useAgentStore
          .getState()
          .setError(sessionId, 'Collaboration is not ready yet.')
        return
      }

      // 1. Gather open-file context from the LIVE Y.Text (not stale store).
      const { tabs, activeFile } = useEditorStore.getState()
      const openFiles: AgentOpenFile[] = tabs.map((t) => ({
        path: t.path,
        language: t.language,
        content: ydoc.getText(`file:${t.path}`).toString(),
        isActive: t.path === activeFile,
      }))

      // 2. Snapshot history BEFORE appending the new user message. The
      //    route will recompose the user turn from (message + openFiles).
      const prior = useAgentStore.getState().conversations[sessionId] ?? []
      const history = prior
        .filter((m): m is AgentMessage =>
          m.role === 'user' || m.role === 'assistant'
        )
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          text: m.text,
        }))

      // 3. Append the user message + begin a streaming assistant message.
      const store = useAgentStore.getState()
      store.appendUser(sessionId, trimmed)
      const assistantId = store.beginAssistant(sessionId)

      // 4. Fire the request.
      const controller = new AbortController()
      abortRef.current = controller
      let res: Response
      try {
        res = await fetch(`/api/sessions/${sessionId}/agent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: trimmed,
            openFiles,
            history,
          }),
          signal: controller.signal,
        })
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Network error'
        useAgentStore
          .getState()
          .finishAssistant(sessionId, assistantId, 'error', msg)
        return
      }

      if (!res.ok || !res.body) {
        // Try to parse a JSON error envelope.
        let msg = `Request failed (${res.status})`
        try {
          const j = (await res.json()) as {
            error?: { message?: string }
          }
          if (j?.error?.message) msg = j.error.message
        } catch {
          // fall through
        }
        useAgentStore
          .getState()
          .finishAssistant(sessionId, assistantId, 'error', msg)
        return
      }

      // 5. Read the SSE stream.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalized = false

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parsed = parseSseBuffer(buffer)
          buffer = parsed.rest
          for (const frame of parsed.frames) {
            if (frame.event === 'text_delta') {
              try {
                const payload = JSON.parse(frame.data) as { text: string }
                useAgentStore
                  .getState()
                  .appendDelta(sessionId, assistantId, payload.text)
              } catch {
                /* ignore malformed frame */
              }
            } else if (frame.event === 'edit_proposal') {
              try {
                const proposal = JSON.parse(frame.data) as EditProposal
                useAgentStore
                  .getState()
                  .attachProposal(sessionId, assistantId, proposal)
              } catch {
                /* ignore malformed frame */
              }
            } else if (frame.event === 'done') {
              useAgentStore
                .getState()
                .finishAssistant(sessionId, assistantId, 'done')
              finalized = true
            } else if (frame.event === 'error') {
              let msg = 'Stream error'
              try {
                const payload = JSON.parse(frame.data) as { message: string }
                if (payload?.message) msg = payload.message
              } catch {
                /* ignore */
              }
              useAgentStore
                .getState()
                .finishAssistant(sessionId, assistantId, 'error', msg)
              finalized = true
            }
          }
        }
      } catch (err) {
        if (!finalized) {
          const msg =
            (err as Error)?.name === 'AbortError'
              ? 'Cancelled.'
              : (err as Error)?.message ?? 'Stream interrupted'
          useAgentStore
            .getState()
            .finishAssistant(sessionId, assistantId, 'error', msg)
        }
      } finally {
        abortRef.current = null
        if (!finalized) {
          useAgentStore
            .getState()
            .finishAssistant(sessionId, assistantId, 'done')
        }
      }
    },
    [sessionId, ydoc]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // ── Accept: apply the proposal through Yjs so every peer sees it. ──────
  const accept = useCallback(
    (proposalId: string) => {
      if (!ydoc) return
      const store = useAgentStore.getState()
      const proposal = store.pendingProposals[proposalId]
      if (!proposal || proposal.status !== 'pending') return

      const ytext = ydoc.getText(`file:${proposal.filePath}`)

      ydoc.transact(() => {
        if (proposal.mode === 'replace_file') {
          if (ytext.length > 0) ytext.delete(0, ytext.length)
          ytext.insert(0, proposal.newContent)
        } else if (proposal.mode === 'replace_range' && proposal.range) {
          const full = ytext.toString()
          const start = lineColToOffset(
            full,
            proposal.range.startLine,
            proposal.range.startCol
          )
          const endRaw = lineColToOffset(
            full,
            proposal.range.endLine,
            proposal.range.endCol
          )
          const end = Math.max(start, endRaw)
          if (end > start) ytext.delete(start, end - start)
          ytext.insert(start, proposal.newContent)
        }
      }, 'ai-agent')

      store.resolveProposal(proposalId, 'accepted')

      // Focus the changed file in the local editor if it isn't already.
      const editor = useEditorStore.getState()
      if (editor.activeFile !== proposal.filePath) {
        const existing = editor.tabs.find((t) => t.path === proposal.filePath)
        if (existing) {
          editor.setActiveFile(proposal.filePath)
        }
      }
    },
    [ydoc]
  )

  const reject = useCallback((proposalId: string) => {
    useAgentStore.getState().resolveProposal(proposalId, 'rejected')
  }, [])

  return {
    messages,
    isStreaming:
      !!streamingMessageId &&
      messages.some((m) => m.id === streamingMessageId),
    error,
    send,
    stop,
    accept,
    reject,
  }
}

// Stable empty array so the selector doesn't create new references and
// trigger useSyncExternalStore warnings.
const EMPTY_MESSAGES: AgentMessage[] = []
