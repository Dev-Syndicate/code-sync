# CodeSync

Real-time collaborative coding platform for GitHub repositories — think **Google Docs for code**. Sign in with GitHub, open any repo, start a session, invite your team, and edit files together with live cursors, shared drafts, and one-click commits back to the repo. An in-session AI agent (Gemini) can propose edits across multiple files in a single review.

## Features

- **GitHub OAuth sign-in** — one-click auth; repos you can access on GitHub are repos you can collaborate on here.
- **Live multi-cursor editing** — Monaco editor wired to [Yjs](https://yjs.dev) CRDTs over a WebSocket relay. Cursors, selections, and edits replicate instantly with per-user colors and name tags.
- **Shared drafts, per-session** — every keystroke goes into a per-session draft so nothing is lost on reconnect. Explicit "Save draft" persists it to Firestore.
- **Commit & Push** — review the diff of changed files, write a commit message, and push straight back to the user's GitHub branch — using their OAuth token, scoped to repos they already have write access to.
- **Commit history + revert** — see past commits from inside the session; revert a commit with a one-click inverse.
- **File CRUD + explorer** — create, rename, delete files and folders from the in-session tree with Yjs-propagated updates. "Refresh from GitHub" reconciles the tree against the latest remote state and surfaces conflicts.
- **AI Agent panel** — a Gemini-powered assistant that reads your session context, proposes multi-file edits, and lets you accept/reject each change individually.
- **Team chat** — per-session Firestore-backed chat with system events (joined, saved, ended).
- **Live presence + analytics** — avatar row in the header, sidebar "active sessions" snapshot, 7-day analytics chart.
- **End session flow** — host-only; Firestore listener kicks every participant back to their dashboard when the session is closed.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) + React 19.2 |
| Styling | Tailwind CSS v4 + Radix UI primitives + custom emerald theme |
| Auth + DB | Firebase Auth (GitHub provider) + Firestore (sessions, chat, presence, users) |
| Admin | Firebase Admin SDK (session cookies, token storage, server-side reads) |
| Real-time editing | Yjs + y-websocket (standalone relay server in [`server/`](./server)) |
| Editor | Monaco (`@monaco-editor/react`) + `y-monaco` binding |
| GitHub integration | GitHub REST API via the user's OAuth token (`/user/repos`, `/contents`, `/git/trees`, `/branches`, `/commits`) |
| AI | Google Gemini (`@google/genai`) via server-side route |
| State | Zustand stores (`authStore`, `sessionStore`, `editorStore`, `repoStore`, `toastStore`) |
| Deployment | Vercel (Next app) + Railway (Yjs WebSocket server) |

## Architecture

```
┌─────────────────────┐
│   Next.js (Vercel)  │
│  • UI + API routes  │
│  • GitHub OAuth     │
│  • Firestore reads  │
│  • Gemini agent     │
└──────────┬──────────┘
           │ HTTPS
           │
    ┌──────┴──────┐                 ┌──────────────────┐
    │   Browser   │ ── wss:// ───►  │ Yjs WS (Railway) │
    │  Monaco +   │                 │ y-websocket      │
    │  y-monaco   │                 │ in-memory rooms  │
    └──────┬──────┘                 └──────────────────┘
           │
           │ HTTPS
           ▼
    ┌──────────────┐                ┌─────────────┐
    │   Firestore  │                │    GitHub   │
    │  sessions,   │                │  contents,  │
    │  chat, users │                │  commits    │
    └──────────────┘                └─────────────┘
```

Key mental model:

- **Firestore** holds persistent state — sessions, chat, presence, drafts, user profiles. It's *not* used for per-keystroke sync.
- **Yjs + WebSocket** handles live edits. The relay server in [`server/yjs-server.ts`](./server/yjs-server.ts) maintains one in-memory `Y.Doc` per session id and rebroadcasts CRDT updates between connected peers.
- **GitHub** is the source of truth for file content on disk. Drafts live on top; committing flushes them back.

For the full technical spec, see [TDD-CodeSync.md](./TDD-CodeSync.md). For the product brief, see [PRD-CodeSync.md](./PRD-CodeSync.md).

## Getting started (local dev)

### Prerequisites

- Node.js 20+
- A Firebase project with Authentication (GitHub provider) and Firestore enabled
- A GitHub OAuth app (for the sign-in flow)
- A Google Gemini API key (optional — only needed for the AI Agent panel)

### 1. Install

```bash
npm install
cd server && npm install && cd ..
```

### 2. Environment variables

Create `.env.local` at the repo root with:

```bash
# ── Firebase client (public) ──
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# ── Firebase Admin (server-only) ──
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@<project>.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── GitHub OAuth ──
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# ── Yjs WebSocket server URL ──
# Default points at the local dev server started with `cd server && npm run dev`.
NEXT_PUBLIC_YJS_WS_URL=ws://localhost:1234

# ── AI Agent (optional) ──
GEMINI_API_KEY=...
```

In the Firebase console → **Authentication** → **Settings** → **Authorized domains**, add `localhost` (already there by default) and any deployment domains.

### 3. Run

In two terminals:

```bash
# Terminal 1 — Yjs signaling server
cd server
npm run dev             # listens on ws://localhost:1234

# Terminal 2 — Next.js app
npm run dev             # http://localhost:3000
```

Sign in with GitHub, pick a repo, start a session, and open the session URL in a second browser to see live collaboration.

## Commands

- `npm run dev` — start the Next.js dev server at http://localhost:3000
- `npm run build` — production build (runs `next build` with strict type checking)
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, extends `next/core-web-vitals` + `next/typescript`)
- `cd server && npm run dev` — start the Yjs WebSocket server in watch mode
- `cd server && npm start` — run the Yjs server (production)

No test runner is configured.

## Project structure

```
code-sync/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # login, OAuth callback
│   │   ├── api/                # route handlers (auth, repos, sessions, commits, agent)
│   │   ├── dashboard/          # repo picker, profile, help
│   │   ├── session/[sessionId] # live editor page
│   │   └── globals.css         # Tailwind v4 + custom emerald theme tokens
│   ├── components/
│   │   ├── auth/               # login button, user avatar, guard
│   │   ├── dashboard/          # sidebar, repo list, session analytics, command palette
│   │   ├── editor/             # Monaco wrapper, file tree, tabs, context menu
│   │   ├── session/            # header, activity bar, share link, commit modal
│   │   ├── chat/               # team chat panel
│   │   ├── agent/              # AI agent panel + proposal cards
│   │   ├── providers/          # theme, auth, toast providers
│   │   └── ui/                 # radix primitives (dialog, dropdown, select, ConfirmDialog)
│   ├── hooks/                  # useAuth, useSession, useCollaboration, useMonacoYjsBinding, ...
│   ├── lib/
│   │   ├── api/                # server-side auth helpers, response envelope
│   │   ├── firebase/           # client + admin SDK, Firestore models
│   │   ├── github/             # GitHub REST wrappers (repos, commits, branches)
│   │   ├── gemini/             # AI agent prompt + proposal generator
│   │   ├── yjs/                # y-websocket provider + awareness helpers
│   │   ├── session/            # session create/join/rehydrate helpers
│   │   └── drafts/             # YDocDiffer — Y.Text to file-change differ
│   ├── store/                  # Zustand stores
│   └── types/                  # shared TS types
├── server/                     # standalone Yjs WebSocket relay (deployed separately)
│   ├── yjs-server.ts
│   ├── package.json
│   └── tsconfig.json
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Firestore composite indexes
└── next.config.ts
```

## Deployment

CodeSync deploys as **two services**:

### 1. Next.js app → Vercel

- Connect the repo to Vercel; Vercel auto-detects Next 16.
- Add all env vars above (both `NEXT_PUBLIC_*` client vars and server-only vars) in **Settings → Environment Variables**.
- Set `NEXT_PUBLIC_YJS_WS_URL` to your Railway WebSocket URL with **`wss://`** (TLS) once the Yjs server is deployed.
- Add your Vercel production URL (and preview URLs) to **Firebase Authorized Domains**, or use a custom domain so you don't have to whitelist every preview.
- Configure the **GitHub OAuth app** callback to point at `https://<your-vercel-domain>/api/auth/github/callback`.

### 2. Yjs WebSocket server → Railway

- New Railway project → Deploy from GitHub repo → pick `code-sync`.
- **Settings → Source → Root Directory** = `server` (critical — otherwise Railway tries to build the whole Next app).
- **Settings → Networking** → Generate Domain. Set **Target Port** to `8080` (or whatever `PORT` Railway assigns — the server reads `process.env.PORT` first).
- No other env vars needed; the server has no external dependencies beyond `ws` and `y-websocket`.
- Verify by hitting `https://<your-domain>/healthz` — should return `CodeSync Yjs server — ok`.
- Paste the `wss://<your-domain>` URL into Vercel's `NEXT_PUBLIC_YJS_WS_URL` and redeploy Vercel (the `NEXT_PUBLIC_*` var is baked in at build time).

## Security notes

- **Never commit service-account JSON files into git.** The Firebase Admin key belongs in env vars only. The current repo has a legacy key file checked in under a name referenced by `CLAUDE.md` — rotate it before publishing the repo and load credentials via `FIREBASE_ADMIN_*` env vars exclusively.
- All state-mutating API routes verify the Firebase session cookie via `adminAuth.verifySessionCookie`. Firestore rules are currently permissive (auth happens in the route handlers); tighten them before a real launch.
- GitHub access tokens are stored server-side in a private Firestore subcollection, never sent to the client. Every commit/push goes through an API route that re-reads the token for the authenticated user.

## Notable files

- [CLAUDE.md](./CLAUDE.md) — guidance for AI coding assistants working in this repo (architecture mental model, ownership boundaries, Next 16 quirks).
- [DEV-RULES.md](./DEV-RULES.md) — strict file-ownership rules for multi-developer branches.
- [PRD-CodeSync.md](./PRD-CodeSync.md) — product requirements.
- [TDD-CodeSync.md](./TDD-CodeSync.md) — technical design.

## License

Private / unreleased.
