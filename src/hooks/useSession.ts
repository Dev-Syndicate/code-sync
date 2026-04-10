'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import { joinSession as joinSessionApi } from '@/lib/session/join'
import { useAuth } from '@/hooks/useAuth'
import type { Session, Participant } from '@/types'
import { Timestamp } from 'firebase/firestore'

// ────────────────────────────────────────────────
// TODO: REMOVE MOCK — flip to false when Firestore session listener is ready
const USE_MOCK = true
// ────────────────────────────────────────────────

/**
 * useSession — Integration contract for Dev 3
 *
 * ⚠️  FROZEN CONTRACT — Do NOT change the return shape without team discussion.
 * Dev 3 depends on this exact interface for the editor page.
 */
export function useSession(sessionId: string) {
  const { user } = useAuth()
  const { setCurrentSession, setLoading, setError } = useSessionStore()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLocalLoading] = useState(true)
  const [error, setLocalError] = useState<string | null>(null)

  // Fetch session data
  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      setLocalLoading(true)
      setLocalError(null)

      try {
        if (USE_MOCK) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          if (cancelled) return

          const mockSession: Session = {
            id: sessionId,
            repo: 'code-sync',
            repoOwner: 'devuser',
            repoUrl: 'https://github.com/devuser/code-sync',
            branch: 'main',
            owner: 'owner-uid-123',
            participants: {
              'owner-uid-123': {
                username: 'sessionowner',
                avatar: 'https://avatars.githubusercontent.com/u/2?v=4',
                color: '#ef4444',
                joinedAt: Timestamp.now(),
              },
              'user-uid-456': {
                username: 'collaborator1',
                avatar: 'https://avatars.githubusercontent.com/u/3?v=4',
                color: '#22c55e',
                joinedAt: Timestamp.now(),
              },
            },
            files: [
              { path: 'src/index.ts', language: 'typescript', sha: 'abc123' },
              { path: 'src/app.tsx', language: 'typescriptreact', sha: 'def456' },
              { path: 'README.md', language: 'markdown', sha: 'ghi789' },
            ],
            active: true,
            maxParticipants: 4,
            createdAt: Timestamp.now(),
            closedAt: null,
            lastDraftAt: null,
          }

          setSession(mockSession)
          setCurrentSession(mockSession)
        } else {
          // Real Firestore fetch — will be replaced with onSnapshot listener
          const res = await fetch(`/api/sessions/${sessionId}`)
          const json = await res.json()

          if (!cancelled) {
            if (json.success) {
              setSession(json.data)
              setCurrentSession(json.data)
            } else {
              setLocalError(json.error?.message ?? 'Session not found')
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLocalError('Failed to load session')
        }
      } finally {
        if (!cancelled) {
          setLocalLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      cancelled = true
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

    // Remove user from participants locally
    const updatedParticipants = { ...session.participants }
    delete updatedParticipants[user.uid]

    const updatedSession: Session = {
      ...session,
      participants: updatedParticipants,
    }

    setSession(updatedSession)
    setCurrentSession(null)

    // TODO: Call Firestore to persist the leave action when real backend is ready
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
