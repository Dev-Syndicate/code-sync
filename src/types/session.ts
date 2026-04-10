import type { Timestamp } from 'firebase/firestore'

// ── Cursor color palette ──
export const CURSOR_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
] as const

export type CursorColor = typeof CURSOR_COLORS[number]

// ── Participant in a session ──
export interface Participant {
  username: string
  avatar: string
  color: CursorColor
  joinedAt: Timestamp
}

// ── File loaded from GitHub into the session ──
export interface FileEntry {
  path: string
  language: string
  sha: string
}

// ── Session Firestore document ──
export interface SessionDoc {
  repo: string
  repoOwner: string
  repoUrl: string
  branch: string
  owner: string
  participants: Record<string, Participant>
  files: FileEntry[]
  active: boolean
  maxParticipants: number
  createdAt: Timestamp
  closedAt: Timestamp | null
  lastDraftAt: Timestamp | null
}

// ── App-level session type (with document ID) ──
export interface Session extends SessionDoc {
  id: string
}

// ── Input for creating a new session ──
export type CreateSessionInput = Pick<
  SessionDoc,
  'repo' | 'repoOwner' | 'repoUrl' | 'branch' | 'owner' | 'files'
> & {
  maxParticipants?: number
}

// ── File editor tracking ──
export interface EditorEntry {
  userId: string
  username: string
  githubName: string
  email: string
  avatar: string
  editedAt: Timestamp
}

export interface FileEditorDoc {
  filename: string
  editors: EditorEntry[]
}
