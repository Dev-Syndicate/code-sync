'use client'

import { useCallback, useMemo, useEffect, useSyncExternalStore } from 'react'
import * as Y from 'yjs'
import type { WebrtcProvider } from 'y-webrtc'
import { createCollabProvider, destroyCollabProvider } from '@/lib/yjs/provider'
import {
  setLocalAwareness,
  onAwarenessChange,
  type AwarenessUserState,
} from '@/lib/yjs/awareness'

interface UseCollaborationOptions {
  sessionId: string
  userId: string
  username: string
  avatar: string
  color: string
}

interface CollabSnapshot {
  ydoc: Y.Doc | null
  provider: WebrtcProvider | null
  isReady: boolean
  remoteUsers: AwarenessUserState[]
}

interface UseCollaborationReturn extends CollabSnapshot {
  getText: (fileName: string) => Y.Text
}

/**
 * Main collaboration hook — sets up Yjs doc, WebRTC provider, and awareness.
 * Uses useSyncExternalStore for React 19 compliance.
 */
export function useCollaboration(
  options: UseCollaborationOptions
): UseCollaborationReturn {
  const { sessionId, userId, username, avatar, color } = options

  const store = useMemo(() => {
    const listeners = new Set<() => void>()

    // Use a container object so property mutations are allowed by react-hooks/immutability
    const state: { current: CollabSnapshot } = {
      current: { ydoc: null, provider: null, isReady: false, remoteUsers: [] },
    }


    // Initialize Yjs + WebRTC if we have a session
    if (sessionId) {
      const doc = new Y.Doc()
      const prov = createCollabProvider(sessionId, doc)

      state.current = { ydoc: doc, provider: prov, isReady: false, remoteUsers: [] }

      setLocalAwareness(prov, {
        userId,
        username,
        avatar,
        color,
        currentFile: null,
        cursor: null,
      })

      onAwarenessChange(prov, (states) => {
        state.current = { ...state.current, remoteUsers: states }
        listeners.forEach((l) => l())
      })

      prov.on('status', ({ connected }: { connected: boolean }) => {
        if (connected) {
          state.current = { ...state.current, isReady: true }
          listeners.forEach((l) => l())
        }
      })

      setTimeout(() => {
        state.current = { ...state.current, isReady: true }
        listeners.forEach((l) => l())
      }, 2000)
    }

    return {
      getSnapshot: () => state.current,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      getYdoc: () => state.current.ydoc,
      cleanup: () => {
        if (state.current.provider) destroyCollabProvider(state.current.provider)
        if (state.current.ydoc) state.current.ydoc.destroy()
        state.current = { ydoc: null, provider: null, isReady: false, remoteUsers: [] }
        listeners.forEach((l) => l())
      },
    }
  }, [sessionId, userId, username, avatar, color])

  useEffect(() => {
    return () => store.cleanup()
  }, [store])

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  )

  const getText = useCallback(
    (fileName: string): Y.Text => {
      const doc = store.getYdoc()
      if (!doc) throw new Error('Yjs document not initialized')
      return doc.getText(`file:${fileName}`)
    },
    [store]
  )

  return { ...snapshot, getText }
}
