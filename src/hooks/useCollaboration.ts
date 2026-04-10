'use client'

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
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

const EMPTY_SNAPSHOT: CollabSnapshot = {
  ydoc: null,
  provider: null,
  isReady: false,
  remoteUsers: [],
}

/**
 * Mutable external store for the collaboration state.
 *
 * We deliberately keep all side effects (Yjs doc + WebRTC provider + awareness
 * subscriptions) OUTSIDE of React's render/useMemo path and drive them from a
 * `useEffect` that is keyed on `sessionId` alone. This guarantees:
 *   1. exactly one `createCollabProvider` call per session mount, so y-webrtc
 *      never throws "A Yjs Doc connected to room X already exists" under
 *      Strict Mode or when identity props change.
 *   2. the provider is NOT recreated when userId/username/avatar/color change —
 *      those are pushed into awareness by a separate effect.
 */
function createCollabStore() {
  let snapshot: CollabSnapshot = EMPTY_SNAPSHOT
  const listeners = new Set<() => void>()

  const emit = () => {
    listeners.forEach((l) => l())
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set: (next: CollabSnapshot) => {
      snapshot = next
      emit()
    },
    patch: (partial: Partial<CollabSnapshot>) => {
      snapshot = { ...snapshot, ...partial }
      emit()
    },
    reset: () => {
      snapshot = EMPTY_SNAPSHOT
      emit()
    },
  }
}

/**
 * Main collaboration hook — sets up Yjs doc, WebRTC provider, and awareness.
 */
export function useCollaboration(
  options: UseCollaborationOptions
): UseCollaborationReturn {
  const { sessionId, userId, username, avatar, color } = options

  // One store instance per hook invocation. Stable across renders.
  const store = useMemo(() => createCollabStore(), [])
  const providerRef = useRef<WebrtcProvider | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)

  // ── Provider lifecycle: one provider per sessionId ─────────────────
  useEffect(() => {
    if (!sessionId) return

    const doc = new Y.Doc()
    const prov = createCollabProvider(sessionId, doc)

    ydocRef.current = doc
    providerRef.current = prov

    // Initial snapshot push happens from an event callback (timer), not
    // synchronously, so the set-state-in-effect lint stays happy.
    const initTimer = setTimeout(() => {
      store.set({
        ydoc: doc,
        provider: prov,
        isReady: false,
        remoteUsers: [],
      })
    }, 0)

    const unsubAwareness = onAwarenessChange(prov, (states) => {
      store.patch({ remoteUsers: states })
    })

    const handleStatus = ({ connected }: { connected: boolean }) => {
      if (connected) store.patch({ isReady: true })
    }
    prov.on('status', handleStatus)

    // Fallback: mark ready after 2s even if no peer connects (solo session)
    const readyTimer = setTimeout(() => {
      store.patch({ isReady: true })
    }, 2000)

    return () => {
      clearTimeout(initTimer)
      clearTimeout(readyTimer)
      unsubAwareness()
      prov.off('status', handleStatus)
      destroyCollabProvider(prov)
      doc.destroy()

      ydocRef.current = null
      providerRef.current = null
      store.reset()
    }
  }, [sessionId, store])

  // ── Identity: push into awareness without touching the provider ────
  useEffect(() => {
    const prov = providerRef.current
    if (!prov) return
    setLocalAwareness(prov, {
      userId,
      username,
      avatar,
      color,
      currentFile: null,
      cursor: null,
    })
  }, [userId, username, avatar, color])

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  )

  const getText = useCallback((fileName: string): Y.Text => {
    const doc = ydocRef.current
    if (!doc) throw new Error('Yjs document not initialized')
    return doc.getText(`file:${fileName}`)
  }, [])

  return { ...snapshot, getText }
}
