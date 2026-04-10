# 🔌 Dev 4 — API Routes, GitHub Integration & Chat

> **Branch:** `feature/dev4-api`
> **Owner:** Dev 4

---

## 🎯 Your Mission

Build ALL server-side API routes, the GitHub REST API integration (repos, commits, co-author credits), and the real-time chat system.

---

## 📁 Files You OWN (only you edit these)

```
src/app/api/auth/github/route.ts
src/app/api/auth/github/callback/route.ts
src/app/api/repos/route.ts
src/app/api/sessions/route.ts
src/app/api/commits/route.ts
src/lib/github/api.ts
src/lib/github/repos.ts
src/lib/github/commits.ts
src/lib/github/buildCommitMessage.ts
src/components/chat/ChatPanel.tsx
src/components/chat/ChatMessage.tsx
src/components/chat/ChatInput.tsx
src/hooks/useChat.ts
```

## ⚠️ Files You Share (coordinate before editing)

```
src/components/providers/AppProviders.tsx   → Only if adding a new provider
src/types/*                                → Propose changes in group chat first
src/components/ui/*                        → Claim specific ones in group chat
.env.example                               → Add GitHub OAuth env vars
package.json                               → Only add YOUR dependencies
```

## 🚫 Files You Must NOT Touch

```
src/app/(auth)/*                           → Dev 1
src/components/auth/*                      → Dev 1
src/lib/firebase/config.ts                 → Dev 1
src/middleware.ts                           → Dev 1
src/app/dashboard/*                        → Dev 2
src/components/dashboard/*                 → Dev 2
src/lib/session/*                          → Dev 2
src/app/session/*                          → Dev 3
src/components/editor/*                    → Dev 3
src/components/session/*                   → Dev 3
src/lib/yjs/*                              → Dev 3
```

---

## 📋 Task Checklist

### Phase 1: GitHub OAuth API Routes
- [ ] Implement `/api/auth/github/route.ts` — redirect to GitHub OAuth
- [ ] Implement `/api/auth/github/callback/route.ts` — exchange code for token
- [ ] Store access token in Firestore (`/users/{id}/private/tokens`)
- [ ] Set HTTP-only session cookie
- [ ] Coordinate with Dev 1 on cookie format

### Phase 2: GitHub API Client
- [ ] Implement `src/lib/github/api.ts` — authenticated fetch wrapper
- [ ] Implement `src/lib/github/repos.ts` — fetchUserRepos, fetchRepoContents
- [ ] Implement `/api/repos/route.ts` — GET user's repositories

### Phase 3: Session API
- [ ] Implement `/api/sessions/route.ts` — POST create, GET list sessions
- [ ] Add session validation (check user is participant)
- [ ] Return `ApiResponse<Session>` format

### Phase 4: Commit & Co-Author System
- [ ] Implement `src/lib/github/commits.ts` — Git Tree API commit flow
- [ ] Implement `src/lib/github/buildCommitMessage.ts` — auto co-author trailers
- [ ] Implement `/api/commits/route.ts` — POST commit and push
- [ ] Read `fileEditors` from Firestore for co-author credits

### Phase 5: Chat System
- [ ] Implement `useChat.ts` — Firestore real-time chat listener
- [ ] Build `ChatPanel.tsx` — chat container with auto-scroll
- [ ] Build `ChatMessage.tsx` — message bubble (user + system messages)
- [ ] Build `ChatInput.tsx` — input field with send button
- [ ] Add system messages for join/leave/commit events

---

## 🔌 Dependencies on Other Devs

| You Need | From | Status |
|---|---|---|
| Firebase Firestore instance | Dev 1 | `db` from `lib/firebase/config.ts` |
| Session cookie format | Dev 1 | Coordinate on cookie name & shape |
| `editorStore.getDirtyFiles()` | Dev 3 | For commit payload |
| `CommitPayload` type | Shared types | Already defined ✅ |
| `FileEditorDoc` type | Shared types | Already defined ✅ |

## 🤝 Integration Contracts

### All API routes MUST use this response format:

```typescript
import type { ApiResponse, ErrorCode } from '@/types'

// Success response helper
function apiSuccess<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data })
}

// Error response helper  
function apiError(code: ErrorCode, message: string, status: number): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

// Usage:
export async function GET() {
  try {
    const repos = await fetchUserRepos(token)
    return apiSuccess(repos)
  } catch {
    return apiError('GITHUB_ERROR', 'Failed to fetch repos', 502)
  }
}
```

### Co-Author Commit Message Format:

```
feat: collaborative changes from CodeSync session

Co-authored-by: username <email@users.noreply.github.com>
Co-authored-by: username2 <email2@users.noreply.github.com>
```

---

## 🧪 How to Test

1. Test OAuth: Visit `/api/auth/github` → should redirect to GitHub
2. Test repos: `curl http://localhost:3000/api/repos` (with session cookie)
3. Test sessions: POST to `/api/sessions` → should create Firestore doc
4. Test commit: POST to `/api/commits` with test payload
5. Test chat: Open session page → send messages between two tabs

---

## ⚡ Golden Rules

1. **All API routes return `ApiResponse<T>`** — never return raw data
2. **Never expose GitHub tokens** to the client — tokens stay server-side
3. **Never push to `main`** — always push to `feature/dev4-api` and create a PR
4. **Validate all request bodies** — never trust client input
5. **Use `apiError()` helper** — don't create custom error shapes
6. **Announce in group chat** before editing any shared file
7. **Run `npm run lint`** before every commit
8. **Pull from `main`** daily to stay in sync
