import { create } from 'zustand'
import type { Session } from '@/types'

interface SessionStore {
  sessions: Session[]
  currentSession: Session | null
  loading: boolean
  error: string | null

  // Actions
  setSessions: (sessions: Session[]) => void
  setCurrentSession: (session: Session | null) => void
  addSession: (session: Session) => void
  removeSession: (sessionId: string) => void
  updateSession: (sessionId: string, updates: Partial<Session>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),

  setCurrentSession: (currentSession) => set({ currentSession }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
    })),

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      currentSession:
        state.currentSession?.id === sessionId
          ? null
          : state.currentSession,
    })),

  updateSession: (sessionId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, ...updates } : s
      ),
      currentSession:
        state.currentSession?.id === sessionId
          ? { ...state.currentSession, ...updates }
          : state.currentSession,
    })),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
