// Types for the in-editor AI coding agent.
//
// These are shared between the client (store, hook, UI) and the server
// (streaming API route). The conversation itself is NEVER sent over the
// network for other peers — it lives in a per-browser Zustand store. Only
// accepted EditProposals are applied through Yjs (and therefore visible to
// all peers in the session).

export type AgentRole = 'user' | 'assistant'

export interface AgentUserMessage {
  id: string
  role: 'user'
  text: string
  createdAt: number
}

export interface AgentAssistantMessage {
  id: string
  role: 'assistant'
  text: string
  proposalIds: string[]
  status: 'streaming' | 'done' | 'error'
  errorMessage?: string
  createdAt: number
}

export type AgentMessage = AgentUserMessage | AgentAssistantMessage

// ── Edit proposals ─────────────────────────────────────────────────────────
// The agent emits these inside fenced ```codesync-edit ... ``` blocks in its
// streamed output. A parser on the server extracts them and streams them to
// the client as structured events, separate from text deltas.

export type EditProposalMode = 'replace_file' | 'replace_range'

export interface EditProposalRange {
  startLine: number // 1-indexed, Monaco-style
  startCol: number
  endLine: number
  endCol: number
}

export interface EditProposal {
  id: string
  filePath: string
  mode: EditProposalMode
  range?: EditProposalRange
  newContent: string
  explanation: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: number
}

// The raw shape the model is asked to emit (no id, no status, no createdAt).
export interface RawEditProposal {
  filePath: string
  mode: EditProposalMode
  range?: EditProposalRange
  newContent: string
  explanation: string
}

// ── Open file context sent with each request ───────────────────────────────
export interface AgentOpenFile {
  path: string
  language: string
  content: string
  isActive: boolean
}

// ── API request / SSE event shapes ─────────────────────────────────────────
export interface AgentRequestBody {
  message: string
  openFiles: AgentOpenFile[]
  history: Array<{ role: AgentRole; text: string }>
}

export type AgentStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'edit_proposal'; proposal: EditProposal }
  | { type: 'done' }
  | { type: 'error'; message: string }
