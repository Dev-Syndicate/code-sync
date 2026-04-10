'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection, onSnapshot, addDoc, serverTimestamp,
  query, orderBy, limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import type { ChatMessage, SendMessageInput } from '@/types/chat'

interface UseChatReturn {
  messages:    ChatMessage[]
  sendMessage: (text: string) => Promise<void>
  loading:     boolean
}

export function useChat(sessionId: string | null): UseChatReturn {
  const { user }                    = useAuth()
  const [messages, setMessages]     = useState<ChatMessage[]>([])
  const [loading, setLoading]       = useState(true)
  const sendingRef                  = useRef(false)

  // Real-time listener on session chat subcollection
  useEffect(() => {
    if (!sessionId) return

    const chatRef = collection(db, 'sessions', sessionId, 'chat')
    const q       = query(chatRef, orderBy('timestamp', 'asc'), limit(200))

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((doc) => ({
        id:          doc.id,
        ...(doc.data() as Omit<ChatMessage, 'id'>),
      }))
      setMessages(msgs)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [sessionId])

  const sendMessage = useCallback(async (text: string): Promise<void> => {
    if (!sessionId || !user || !text.trim() || sendingRef.current) return

    sendingRef.current = true

    const input: SendMessageInput = {
      userId:  user.uid,
      username: user.username,
      avatar:  user.avatar,
      message: text.trim(),
      type:    'message',
    }

    try {
      await addDoc(
        collection(db, 'sessions', sessionId, 'chat'),
        { ...input, timestamp: serverTimestamp() }
      )
    } finally {
      sendingRef.current = false
    }
  }, [sessionId, user])

  return { messages, sendMessage, loading }
}
