import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

// ── ICE servers for WebRTC connection ──
const ICE_SERVERS: RTCIceServer[] = [
  // Free STUN servers (NAT traversal)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },

  // TURN server (relay fallback) — configured via env vars
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? '',
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? '',
        },
      ]
    : []),
]

/**
 * Creates a Yjs WebRTC provider for real-time collaboration.
 * Room name is scoped to the session, and the session ID doubles as the password.
 */
export function createCollabProvider(
  sessionId: string,
  ydoc: Y.Doc
): WebrtcProvider {
  const provider = new WebrtcProvider(
    `codesync-${sessionId}`, // Room name
    ydoc,
    {
      signaling: ['wss://signaling.yjs.dev'],
      password: sessionId,
      maxConns: 20,
      filterBcConns: true,
      peerOpts: {
        config: {
          iceServers: ICE_SERVERS,
        },
      },
    }
  )

  return provider
}

/**
 * Destroys the WebRTC provider and cleans up connections.
 */
export function destroyCollabProvider(provider: WebrtcProvider): void {
  provider.disconnect()
  provider.destroy()
}
