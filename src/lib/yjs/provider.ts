import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

// Default to the local dev server. Override in production by setting
// NEXT_PUBLIC_YJS_WS_URL in the Next.js env (e.g. `wss://yjs.codesync.example.com`).
// See server/README.md for how to run the standalone Yjs server.
const YJS_WS_URL = process.env.NEXT_PUBLIC_YJS_WS_URL ?? 'ws://localhost:1234'

/**
 * Creates a Yjs WebSocket provider for real-time collaboration.
 *
 * Why WebSocket instead of WebRTC:
 *
 * - Reliable: no dependency on a public signaling server (wss://signaling.yjs.dev
 *   was flaky) or NAT traversal (WebRTC breaks on corporate networks without
 *   a TURN server).
 * - Predictable joins: the server holds the authoritative doc in memory, so a
 *   new client joining an "empty" room (no other peers currently online) still
 *   receives the latest state instead of starting blank and clobbering it.
 * - Debuggable: you can tail one process and see every update go through.
 *
 * The WebsocketProvider uses the session id as the "room name" — internally
 * it connects to `${YJS_WS_URL}/${sessionId}`, and the server routes to the
 * right Y.Doc based on that path.
 */
export function createCollabProvider(
  sessionId: string,
  ydoc: Y.Doc
): WebsocketProvider {
  const provider = new WebsocketProvider(
    YJS_WS_URL,
    `codesync-${sessionId}`, // Room name — becomes the URL path segment
    ydoc,
    {
      // Connect immediately on construction. The provider will auto-reconnect
      // on transient drops with exponential backoff (built in to y-websocket).
      connect: true,
    }
  )

  return provider
}

/**
 * Disconnects and tears down the WebSocket provider. After this runs, the
 * provider is unusable — create a new one if you need to reconnect.
 */
export function destroyCollabProvider(provider: WebsocketProvider): void {
  provider.disconnect()
  provider.destroy()
}
