// Zustand store for the in-editor AI coding agent.
//
// Lives per-browser (per-user) — nothing in here is ever sent to other
// peers. The only shared artifact is the Yjs write that happens when the
// user clicks Accept on a proposal, which is handled by useAgentChat, not
// by this store.

import { create } from 'zustand'
import type {
  AgentAssistantMessage,
  AgentMessage,
  EditProposal,
} from '@/types/agent'

interface AgentState {
  // Keyed by sessionId so multiple sessions don't bleed into each other.
  conversations: Record<string, AgentMessage[]>
  // All pending proposals across sessions, keyed by proposal id.
  pendingProposals: Record<string, EditProposal>
  // The id of the assistant message currently streaming, if any.
  streamingMessageId: string | null
  // Session-scoped error (last error seen by the current hook). Cleared on
  // next send.
  error: Record<string, string | null>

  // ── Actions ────────────────────────────────────────────────────────────
  appendUser: (sessionId: string, text: string) => void
  beginAssistant: (sessionId: string) => string // returns new message id
  appendDelta: (sessionId: string, messageId: string, delta: string) => void
  attachProposal: (
    sessionId: string,
    messageId: string,
    proposal: EditProposal
  ) => void
  finishAssistant: (
    sessionId: string,
    messageId: string,
    status: 'done' | 'error',
    errorMessage?: string
  ) => void
  resolveProposal: (
    proposalId: string,
    status: 'accepted' | 'rejected'
  ) => void
  setError: (sessionId: string, message: string | null) => void
  clearSession: (sessionId: string) => void
}

function newMessageId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export const useAgentStore = create<AgentState>((set) => ({
  conversations: {},
  pendingProposals: {},
  streamingMessageId: null,
  error: {},

  appendUser: (sessionId, text) => {
    set((s) => {
      const prev = s.conversations[sessionId] ?? []
      const msg: AgentMessage = {
        id: newMessageId(),
        role: 'user',
        text,
        createdAt: Date.now(),
      }
      return {
        conversations: { ...s.conversations, [sessionId]: [...prev, msg] },
        error: { ...s.error, [sessionId]: null },
      }
    })
  },

  beginAssistant: (sessionId) => {
    const id = newMessageId()
    set((s) => {
      const prev = s.conversations[sessionId] ?? []
      const msg: AgentAssistantMessage = {
        id,
        role: 'assistant',
        text: '',
        proposalIds: [],
        status: 'streaming',
        createdAt: Date.now(),
      }
      return {
        conversations: { ...s.conversations, [sessionId]: [...prev, msg] },
        streamingMessageId: id,
      }
    })
    return id
  },

  appendDelta: (sessionId, messageId, delta) => {
    set((s) => {
      const prev = s.conversations[sessionId] ?? []
      const next = prev.map((m) =>
        m.id === messageId && m.role === 'assistant'
          ? { ...m, text: m.text + delta }
          : m
      )
      return { conversations: { ...s.conversations, [sessionId]: next } }
    })
  },

  attachProposal: (sessionId, messageId, proposal) => {
    set((s) => {
      const prev = s.conversations[sessionId] ?? []
      const next = prev.map((m) =>
        m.id === messageId && m.role === 'assistant'
          ? { ...m, proposalIds: [...m.proposalIds, proposal.id] }
          : m
      )
      return {
        conversations: { ...s.conversations, [sessionId]: next },
        pendingProposals: {
          ...s.pendingProposals,
          [proposal.id]: proposal,
        },
      }
    })
  },

  finishAssistant: (sessionId, messageId, status, errorMessage) => {
    set((s) => {
      const prev = s.conversations[sessionId] ?? []
      const next = prev.map((m) =>
        m.id === messageId && m.role === 'assistant'
          ? { ...m, status, errorMessage }
          : m
      )
      return {
        conversations: { ...s.conversations, [sessionId]: next },
        streamingMessageId:
          s.streamingMessageId === messageId ? null : s.streamingMessageId,
        error:
          status === 'error' && errorMessage
            ? { ...s.error, [sessionId]: errorMessage }
            : s.error,
      }
    })
  },

  resolveProposal: (proposalId, status) => {
    set((s) => {
      const existing = s.pendingProposals[proposalId]
      if (!existing) return s
      return {
        pendingProposals: {
          ...s.pendingProposals,
          [proposalId]: { ...existing, status },
        },
      }
    })
  },

  setError: (sessionId, message) => {
    set((s) => ({ error: { ...s.error, [sessionId]: message } }))
  },

  clearSession: (sessionId) => {
    set((s) => {
      const { [sessionId]: _removed, ...rest } = s.conversations
      void _removed
      return {
        conversations: rest,
        error: { ...s.error, [sessionId]: null },
      }
    })
  },
}))
