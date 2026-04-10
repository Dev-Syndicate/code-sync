import type { Timestamp } from 'firebase/firestore'
import type { CursorColor } from './session'

export interface PresenceDoc {
  online: boolean
  username: string
  avatar: string
  color: CursorColor
  cursorFile: string
  cursorLine: number
  cursorColumn: number
  lastSeen: Timestamp
}

export interface Presence extends PresenceDoc {
  userId: string
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'relayed'
