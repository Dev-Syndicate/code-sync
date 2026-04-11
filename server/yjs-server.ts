// CodeSync Yjs collaboration server
//
// A standalone WebSocket server that relays Yjs CRDT updates between
// clients sharing the same "room" (= CodeSync session id). Replaces the
// previous y-webrtc setup which depended on the unreliable public signaling
// server at wss://signaling.yjs.dev and couldn't traverse corporate NATs
// without a TURN server.
//
// Architecture:
//
//   Client (y-websocket provider) ──ws──┐
//                                        ├──► this server
//   Client (y-websocket provider) ──ws──┘
//
// The server maintains one Y.Doc per room in memory. When a client joins
// a room, y-websocket's setupWSConnection handler runs the full Yjs sync
// protocol: initial state vector exchange, delta fetch, and then forwards
// every subsequent update to all other clients in the room.
//
// Persistence: currently in-memory only. If the server restarts, rooms are
// rebuilt from whatever clients are still connected. For CodeSync this is
// acceptable because the "source of truth" for file content is GitHub, not
// the Yjs doc — the doc just holds in-progress edits. If we later want to
// survive restarts, drop in LeveldbPersistence or a custom Firestore adapter.
//
// Run locally:
//   cd server
//   npm install
//   npm run dev        # uses tsx watch for auto-reload
//
// Env vars:
//   YJS_PORT       - port to listen on (default 1234)
//   YJS_HOST       - host/interface to bind (default 0.0.0.0)

import { WebSocketServer, type WebSocket } from 'ws'
import { createServer, type IncomingMessage } from 'node:http'
// @ts-expect-error - y-websocket's bin/utils is a .cjs file with no type
//                    declarations. The runtime export is correct.
import { setupWSConnection } from 'y-websocket/bin/utils'

// Railway / Render / Fly inject `PORT` for every service and route their
// health checks to it. Prefer that; fall back to `YJS_PORT` for local dev
// where you might run multiple services side-by-side on explicit ports.
const PORT = Number(process.env.PORT ?? process.env.YJS_PORT ?? 1234)
const HOST = process.env.YJS_HOST ?? '0.0.0.0'

// Plain HTTP server so we can answer health checks on GET / and still
// upgrade to websocket on every other path. Any hosting provider that
// hits a health-check endpoint (Fly, Railway, Render) needs this.
const httpServer = createServer((req, res) => {
  if (req.url === '/' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('CodeSync Yjs server — ok\n')
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not found\n')
})

// noServer mode: we manually pair the upgrade event with the ws server
// so the HTTP handler above can coexist with the websocket handler.
const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
  // y-websocket's setupWSConnection derives the room name from the URL
  // pathname. Clients connect to `ws://host:1234/<sessionId>` — the
  // session id becomes the room key.
  setupWSConnection(conn, req, {
    // Garbage-collect the server-side Y.Doc when the last client leaves,
    // so an abandoned room doesn't leak memory. New joiners will create a
    // fresh doc and pull state from any client still alive.
    gc: true,
  })

  const ip =
    req.socket.remoteAddress ?? req.headers['x-forwarded-for'] ?? 'unknown'
  console.log(`[yjs] connect ${req.url} from ${ip}`)

  conn.on('close', () => {
    console.log(`[yjs] disconnect ${req.url}`)
  })
})

httpServer.on('upgrade', (req, socket, head) => {
  // We don't gate access here — the CodeSync app already protects the
  // session page behind its own auth, and the session id is long/unguessable
  // enough that it doubles as a capability. If we ever want to verify the
  // Firebase session cookie on upgrade we'd do it here, but the `session`
  // cookie is HttpOnly so the client can't forward it via ws headers — we'd
  // need a token-in-query scheme instead. Deferred.
  wss.handleUpgrade(req, socket, head, (conn) => {
    wss.emit('connection', conn, req)
  })
})

httpServer.listen(PORT, HOST, () => {
  console.log(`[yjs] listening on ws://${HOST}:${PORT}`)
  console.log(`[yjs] health check: http://${HOST}:${PORT}/healthz`)
})
