import type { WebrtcProvider } from 'y-webrtc'
import type { CursorPosition } from '@/types/editor'

// ── Local awareness state shape ──
export interface AwarenessUserState {
  userId: string
  username: string
  avatar: string
  color: string
  currentFile: string | null
  cursor: CursorPosition | null
}

/**
 * Set the local user's awareness state (cursor position, file, color, etc.)
 */
export function setLocalAwareness(
  provider: WebrtcProvider,
  state: AwarenessUserState
): void {
  provider.awareness.setLocalStateField('user', state)
}

/**
 * Update just the cursor position in the local awareness state.
 */
export function updateCursorPosition(
  provider: WebrtcProvider,
  cursor: CursorPosition,
  currentFile: string
): void {
  provider.awareness.setLocalStateField('user', {
    ...getLocalState(provider),
    cursor,
    currentFile,
  })
}

/**
 * Update which file the local user is currently viewing.
 */
export function updateCurrentFile(
  provider: WebrtcProvider,
  currentFile: string
): void {
  provider.awareness.setLocalStateField('user', {
    ...getLocalState(provider),
    currentFile,
    cursor: null, // Reset cursor when switching files
  })
}

/**
 * Get the local user's awareness state.
 */
function getLocalState(provider: WebrtcProvider): AwarenessUserState {
  const local = provider.awareness.getLocalState()
  return (local?.user as AwarenessUserState) ?? {
    userId: '',
    username: '',
    avatar: '',
    color: '#888',
    currentFile: null,
    cursor: null,
  }
}

/**
 * Get all remote users' awareness states (excludes local).
 */
export function getRemoteStates(
  provider: WebrtcProvider
): AwarenessUserState[] {
  const states: AwarenessUserState[] = []
  const localClientId = provider.awareness.clientID

  provider.awareness.getStates().forEach((state, clientId) => {
    if (clientId !== localClientId && state.user) {
      states.push(state.user as AwarenessUserState)
    }
  })

  return states
}

/**
 * Subscribe to awareness changes and call the callback with remote states.
 * Returns an unsubscribe function.
 */
export function onAwarenessChange(
  provider: WebrtcProvider,
  callback: (remoteStates: AwarenessUserState[]) => void
): () => void {
  const handler = () => {
    callback(getRemoteStates(provider))
  }

  provider.awareness.on('change', handler)
  return () => provider.awareness.off('change', handler)
}
