# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js 16 (NOT the Next.js you know)

This project uses **Next.js 16.2.3** with **React 19.2**. APIs and conventions may differ from your training data. Before writing non-trivial Next.js code (route handlers, middleware, caching, server actions, config), consult the local docs at `node_modules/next/dist/docs/` — particularly `01-app/` for App Router APIs. Heed deprecation notices.

## Commands

- `npm run dev` — start dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `next/core-web-vitals` + `next/typescript`)

No test runner is configured in this repo.

## High-Level Architecture

CodeSync is a real-time collaborative coding platform (Google Docs for code) linked to GitHub. See `PRD-CodeSync.md` and `TDD-CodeSync.md` for full product/technical spec.

**Data & sync layering — this is the key mental model:**

1. **Auth / session cookie** — GitHub OAuth flow lives under [src/app/api/auth/](src/app/api/auth/) (`github`, `session`, `logout`). A `session` cookie is issued server-side and is the sole signal used by [src/middleware.ts](src/middleware.ts) to gate `/dashboard/*` and `/session/*`. Client auth state is mirrored in Zustand ([src/store/authStore.ts](src/store/authStore.ts)) via [src/hooks/useAuth.ts](src/hooks/useAuth.ts) — **the `useAuth` return shape is a contract consumed by dashboard/editor/chat code; do not change it casually** (see `DEV-RULES.md`).
2. **Firestore (persistent state + signaling)** — [src/lib/firebase/](src/lib/firebase/) holds both client (`config.ts`, `auth.ts`, `firestore.ts`, `storage.ts`, `presence.ts`) and admin (`admin.ts`) SDKs. Domain models live in `src/lib/firebase/models/` (`user.ts`, `session.ts`, `presence.ts`). Firestore stores sessions, users, presence, chat, and WebRTC signaling. Rules and indexes: `firestore.rules`, `firestore.indexes.json`.
3. **Yjs + WebRTC (live editing)** — [src/lib/yjs/](src/lib/yjs/) (`provider.ts`, `awareness.ts`) drives the Monaco editor via `y-monaco`. Editing is peer-to-peer over `y-webrtc`; Firestore is only used for signaling and metadata, **not** for per-keystroke sync. Editor UI lives in [src/components/editor/](src/components/editor/) with state in [src/store/editorStore.ts](src/store/editorStore.ts).
4. **GitHub integration** — [src/lib/github/](src/lib/github/) (`api.ts`, `repos.ts`, `commits.ts`, `buildCommitMessage.ts`) wraps the GitHub REST API using the user's OAuth token. Exposed via API routes in [src/app/api/repos/](src/app/api/repos/) and [src/app/api/commits/](src/app/api/commits/). Sessions are created server-side at [src/app/api/sessions/](src/app/api/sessions/) using helpers in [src/lib/session/](src/lib/session/) (`create.ts`, `join.ts`).

**Route groups:** `(auth)` holds login/callback pages with no dashboard chrome. `/dashboard` is the post-login repo picker. `/session/[id]` hosts the live editor + chat.

**State stores (Zustand)** in [src/store/](src/store/): `authStore`, `repoStore`, `sessionStore`, `editorStore`, `toastStore`. Prefer reading/writing through these rather than threading props.

**Providers:** Never edit [src/app/layout.tsx](src/app/layout.tsx) to add context — add new providers to `src/components/providers/AppProviders.tsx` (pattern enforced by `DEV-RULES.md`).

## Ownership Boundaries (multi-dev branches)

This repo is developed across four feature branches (`feature/dev1-auth` … `feature/dev4-api`) that are being merged into `develop`. `DEV-RULES.md` documents strict file ownership per dev. When editing, check that file's ownership — crossing boundaries tends to cause merge conflicts. Notably:

- `src/lib/firebase/*`, `src/middleware.ts`, auth pages/components → Dev 1
- `src/app/dashboard/*`, `src/components/dashboard/*` → Dev 2
- `src/app/session/*`, `src/components/editor/*`, `src/components/session/*`, `src/lib/yjs/*` → Dev 3
- `src/app/api/*`, `src/components/chat/*`, `src/lib/github/*` → Dev 4

`src/types/*`, `AppProviders.tsx`, and `package.json` are shared — coordinate before edits.

## Firebase Admin Credentials

`code-sync-db-firebase-adminsdk-fbsvc-056ff69e7f.json` is a Firebase Admin service-account key checked into the repo. Do not echo its contents, commit copies, or paste it into prompts/logs. It is consumed by `src/lib/firebase/admin.ts`.
