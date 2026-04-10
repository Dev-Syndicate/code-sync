'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
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

interface CollabStore {
  snapshot: CollabSnapshot
  listeners: Set<() => void>
  getSnapshot: () => CollabSnapshot
  subscribe: (listener: () => void) => () => void
  set: (next: CollabSnapshot) => void
  update: (patch: Partial<CollabSnapshot>) => void
}

function createCollabStore(): CollabStore {
  const store: CollabStore = {
    snapshot: EMPTY_SNAPSHOT,
    listeners: new Set(),
    getSnapshot: () => store.snapshot,
    subscribe: (listener) => {
      store.listeners.add(listener)
      return () => {
        store.listeners.delete(listener)
      }
    },
    set: (next) => {
      store.snapshot = next
      store.listeners.forEach((l) => l())
    },
    update: (patch) => {
      store.snapshot = { ...store.snapshot, ...patch }
      store.listeners.forEach((l) => l())
    },
  }
  return store
}

/**
 * Main collaboration hook — sets up Yjs doc, WebRTC provider, and awareness.
 *
 * Design notes:
 *
 * 1. The Yjs doc + WebrtcProvider are created in a useEffect keyed ONLY on
 *    sessionId. `y-webrtc` keeps a module-level `rooms` Map keyed by room
 *    name, and throws "A Yjs Doc connected to room … already exists!" if
 *    two providers ever share a room. That means (a) provider creation
 *    MUST happen in an effect (not useMemo / render) so React guarantees
 *    the previous provider's cleanup runs before the next one starts, and
 *    (b) identity fields (userId/username/avatar/color) must NOT be in the
 *    dep array — they change often and would force a teardown/recreate per
 *    profile update. Those are pushed via awareness instead.
 *
 * 2. React 19 strict mode double-invokes effects in dev. The cleanup in the
 *    return of the setup effect runs between invocations, so the provider
 *    for the first invocation is fully destroyed before the second creates
 *    a new one. That is the contract we rely on here.
 *
 * 3. State is exposed to React via useSyncExternalStore against an
 *    imperative store. We deliberately avoid setState-in-effect so the
 *    React 19 cascading-render lint rule is happy.
 */
export function useCollaboration(
  options: UseCollaborationOptions
): UseCollaborationReturn {
  const { sessionId, userId, username, avatar, color } = options

  // Per-hook-instance imperative store. Created once via lazy useState so
  // the same object is handed back on every render. We never call the setter.
  const [store] = useState(createCollabStore)

  // ── Provider lifecycle: keyed on sessionId only ────────────────────────
  useEffect(() => {
    if (!sessionId) return

    const doc = new Y.Doc()
    const prov = createCollabProvider(sessionId, doc)

    store.set({
      ydoc: doc,
      provider: prov,
      isReady: false,
      remoteUsers: [],
    })

    const unsubscribeAwareness = onAwarenessChange(prov, (states) => {
      store.update({ remoteUsers: states })
    })

    const handleStatus = ({ connected }: { connected: boolean }) => {
      if (connected) {
        store.update({ isReady: true })
      }
    }
    prov.on('status', handleStatus)

    // Fallback: mark ready after 2s even if the signaling server is slow,
    // so the editor doesn't stay stuck in a loading state in offline dev.
    const readyTimer = setTimeout(() => {
      if (!store.getSnapshot().isReady) {
        store.update({ isReady: true })
      }
    }, 2000)

    return () => {
      clearTimeout(readyTimer)
      unsubscribeAwareness()
      prov.off('status', handleStatus)
      destroyCollabProvider(prov)
      doc.destroy()
      store.set(EMPTY_SNAPSHOT)
    }
  }, [sessionId, store])

  // ── Identity sync: push user fields into awareness without tearing the
  //    provider down. Reads the live provider from the store snapshot.
  const currentProvider = store.getSnapshot().provider
  useEffect(() => {
    if (!currentProvider) return
    setLocalAwareness(currentProvider, {
      userId,
      username,
      avatar,
      color,
      currentFile: null,
      cursor: null,
    })
  }, [currentProvider, userId, username, avatar, color])

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  )

  const getText = useCallback(
    (fileName: string): Y.Text => {
      const doc = store.getSnapshot().ydoc
      if (!doc) throw new Error('Yjs document not initialized')
      return doc.getText(`file:${fileName}`)
    },
    [store]
  )

  return { ...snapshot, getText }
}
