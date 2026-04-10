'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { WebsocketProvider } from 'y-websocket'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * Tracks the Yjs WebSocket provider's connection status via
 * useSyncExternalStore. The status bar reads from this.
 *
 * y-websocket emits a 'status' event with payload `{ status: 'connected'
 * | 'disconnected' | 'connecting' }` whenever the underlying WebSocket's
 * state changes. That's all we need — no 'peers' event like y-webrtc.
 */
export function useConnectionStatus(
  provider: WebsocketProvider | null
): ConnectionStatus {
  const store = useMemo(() => {
    // Seed the status from the provider's current wsconnected flag so the
    // UI doesn't flash "connecting" when a cached provider is handed in.
    const initial: ConnectionStatus = provider?.wsconnected
      ? 'connected'
      : 'connecting'
    const state: { current: ConnectionStatus } = { current: initial }
    const listeners = new Set<() => void>()

    function notify() {
      listeners.forEach((l) => l())
    }

    return {
      getSnapshot: () => state.current,
      subscribe: (listener: () => void) => {
        listeners.add(listener)

        if (!provider) {
          return () => {
            listeners.delete(listener)
          }
        }

        const handleStatus = ({ status }: { status: string }) => {
          if (
            status === 'connected' ||
            status === 'disconnected' ||
            status === 'connecting'
          ) {
            state.current = status
            notify()
          }
        }

        provider.on('status', handleStatus)

        return () => {
          listeners.delete(listener)
          provider.off('status', handleStatus)
        }
      },
    }
  }, [provider])

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
