'use client'

import { useEffect, useState, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useSessionStore } from '@/store/sessionStore'
import { joinSession as joinSessionApi } from '@/lib/session/join'
import { useAuth } from '@/hooks/useAuth'
import type { Session, Participant } from '@/types'

/**
 * useSession — Integration contract for Dev 3
 *
 * ⚠️  FROZEN CONTRACT — Do NOT change the return shape without team discussion.
 * Dev 3 depends on this exact interface for the editor page.
 */
export function useSession(sessionId: string) {
  const { user } = useAuth()
  const { setCurrentSession } = useSessionStore()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Real-time Firestore listener for session data
  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      setError('No session ID provided')
      return
    }

    setLoading(true)
    setError(null)

    const sessionRef = doc(db, 'sessions', sessionId)
    const unsubscribe = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) {
          setSession(null)
          setCurrentSession(null)
          setError('Session not found')
          setLoading(false)
          return
        }

        const sessionData: Session = {
          id: snap.id,
          ...snap.data(),
        } as Session

        // Check if session is still active
        if (!sessionData.active) {
          setError('This session has been closed')
        }

        setSession(sessionData)
        setCurrentSession(sessionData)
        setLoading(false)
      },
      (err) => {
        console.error('[useSession] Firestore error:', err)
        setError('Failed to load session')
        setLoading(false)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [sessionId, setCurrentSession])

  // Derive participants array from session.participants record
  const participants: Participant[] = session
    ? Object.values(session.participants)
    : []

  const joinSessionFn = useCallback(async () => {
    if (!user || !sessionId) return

    const updated = await joinSessionApi(sessionId, {
      uid: user.uid,
      username: user.username,
      avatar: user.avatar,
    })

    if (updated) {
      setSession(updated)
      setCurrentSession(updated)
    }
  }, [user, sessionId, setCurrentSession])

  const leaveSession = useCallback(async () => {
    if (!user || !session) return

    try {
      // Import dynamically to avoid circular deps
      const { updateDoc, doc: firestoreDoc, deleteField } = await import('firebase/firestore')
      const sessionRef = firestoreDoc(db, 'sessions', session.id)
      await updateDoc(sessionRef, {
        [`participants.${user.uid}`]: deleteField(),
      })

      setCurrentSession(null)
    } catch (err) {
      console.error('[useSession] leaveSession failed:', err)
    }
  }, [user, session, setCurrentSession])

  // ⚠️ FROZEN RETURN SHAPE — matches DEV-RULES.md contract exactly
  return {
    session,
    loading,
    error,
    participants,
    joinSession: joinSessionFn,
    leaveSession,
  }
}
