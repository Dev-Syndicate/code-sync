'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { WebrtcProvider } from 'y-webrtc'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * Tracks the WebRTC provider's connection status via useSyncExternalStore.
 * Uses a container object for mutable state (React 19 immutability compliance).
 */
export function useConnectionStatus(
  provider: WebrtcProvider | null
): ConnectionStatus {
  const store = useMemo(() => {
    const state: { current: ConnectionStatus } = { current: 'connecting' }
    const listeners = new Set<() => void>()

    function notify() {
      listeners.forEach((l) => l())
    }

    return {
      getSnapshot: () => state.current,
      subscribe: (listener: () => void) => {
        listeners.add(listener)

        if (!provider) {
          return () => listeners.delete(listener)
        }

        const handleStatus = ({ connected }: { connected: boolean }) => {
          state.current = connected ? 'connected' : 'disconnected'
          notify()
        }

        const handlePeers = ({ added }: { added: string[] }) => {
          if (added.length > 0) {
            state.current = 'connected'
            notify()
          }
        }

        provider.on('status', handleStatus)
        provider.on('peers', handlePeers)

        return () => {
          listeners.delete(listener)
          provider.off('status', handleStatus)
          provider.off('peers', handlePeers)
        }
      },
    }
  }, [provider])

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
