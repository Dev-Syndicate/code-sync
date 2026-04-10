# CodeSync Yjs Server

Standalone Node WebSocket server that runs the Yjs collaboration protocol for CodeSync sessions. Replaces the previous `y-webrtc` + `wss://signaling.yjs.dev` setup.

## Why a separate process

Next.js (especially with Turbopack in dev) is awkward to host long-lived WebSocket connections from, and serverless deploy targets won't keep them alive at all. This server is a plain Node process you can run anywhere — locally during dev, or on a small box (Fly.io, Railway, Render, a $5 VPS) in prod.

## Running locally

```bash
cd server
npm install
npm run dev
```

That starts the server on `ws://localhost:1234` with hot-reload via `tsx watch`. You should see:

```
[yjs] listening on ws://0.0.0.0:1234
[yjs] health check: http://0.0.0.0:1234/healthz
```

In a **separate terminal**, start Next.js as usual from the repo root:

```bash
npm run dev
```

The Next.js client reads `NEXT_PUBLIC_YJS_WS_URL` from `.env` (defaults to `ws://localhost:1234` if unset), so both processes just work together.

## Env vars

| Var        | Default   | Purpose                                  |
| ---------- | --------- | ---------------------------------------- |
| `YJS_PORT` | `1234`    | Port the WebSocket server listens on     |
| `YJS_HOST` | `0.0.0.0` | Host/interface to bind                   |

## How it works

- Every CodeSync session id maps to a Yjs "room" on the server.
- Clients connect to `ws://host:1234/<sessionId>` — that path becomes the room key.
- The server keeps one `Y.Doc` per room in memory. When a client joins, `y-websocket`'s `setupWSConnection` handler runs the sync protocol: state vector exchange, delta fetch, and then relays every subsequent update to all other clients in the room.
- Rooms are garbage-collected when the last client leaves.

## Persistence

Currently in-memory only. If the server restarts, any edits that hadn't been committed back to GitHub are lost — but the authoritative source for file content is always GitHub, not the Yjs doc. The doc only holds in-progress edits between the last fetch and the next commit.

If you want to survive restarts later, wire in `y-leveldb` or a custom Firestore persistence adapter via the `persistence` option on `setupWSConnection`.

## Health check

`GET /healthz` returns `200 ok` so hosting providers that require a health endpoint can confirm the process is alive without speaking WebSocket.

## Deployment notes

- This is a separate deployable from the Next.js app. Don't try to host it in the same Vercel deployment — Vercel's serverless functions don't support long-lived WebSocket connections.
- The client needs `NEXT_PUBLIC_YJS_WS_URL` in the Next.js environment to point at wherever you deploy this (e.g. `wss://yjs.codesync.example.com`).
- Use `wss://` (TLS) in production. Terminate TLS at the platform edge (Fly, Railway, Render all do this for you) or put nginx / Caddy in front.
- The session id doubles as a capability today — there's no auth check on upgrade. If you need to lock this down, add a token-in-query scheme and verify it against Firebase Admin in the `upgrade` handler before calling `wss.handleUpgrade`.
