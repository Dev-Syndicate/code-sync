import type { Timestamp } from 'firebase/firestore'

export type MessageType = 'message' | 'system'
export type SystemEventType = 'join' | 'leave' | 'commit'

export interface ChatMessage {
  id: string
  userId: string
  username: string
  avatar: string
  message: string
  type: MessageType
  systemEvent?: SystemEventType
  timestamp: Timestamp
}

export type SendMessageInput = Omit<ChatMessage, 'id' | 'timestamp'>
