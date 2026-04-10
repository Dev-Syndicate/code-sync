# 📊 Dev 2 — Dashboard & Session Management

> **Branch:** `feature/dev2-dashboard`
> **Owner:** Dev 2

---

## 🎯 Your Mission

Build the dashboard where users see their repos, create coding sessions, and manage active sessions. You connect the Auth flow (Dev 1) to the Editor (Dev 3).

---

## 📁 Files You OWN (only you edit these)

```
src/app/dashboard/page.tsx
src/app/dashboard/loading.tsx
src/components/dashboard/RepoList.tsx
src/components/dashboard/RepoCard.tsx
src/components/dashboard/CreateSession.tsx
src/hooks/useRepos.ts
src/hooks/useSession.ts
src/store/repoStore.ts
src/store/sessionStore.ts
src/lib/session/create.ts
src/lib/session/join.ts
```

## ⚠️ Files You Share (coordinate before editing)

```
src/components/providers/AppProviders.tsx   → Only if adding a new provider
src/types/*                                → Propose changes in group chat first
src/components/ui/*                        → Claim specific ones in group chat
.env.example                               → Add new vars, don't remove existing
package.json                               → Only add YOUR dependencies
```

## 🚫 Files You Must NOT Touch

```
src/app/(auth)/*                           → Dev 1
src/components/auth/*                      → Dev 1
src/lib/firebase/*                         → Dev 1
src/middleware.ts                           → Dev 1
src/app/session/*                          → Dev 3
src/components/editor/*                    → Dev 3
src/components/session/*                   → Dev 3
src/components/chat/*                      → Dev 4
src/app/api/*                              → Dev 4
src/lib/github/*                           → Dev 4
src/lib/yjs/*                              → Dev 3
```

---

## 📋 Task Checklist

### Phase 1: Dashboard Page
- [ ] Build dashboard layout (repo list + create session button)
- [ ] Add loading skeleton in `loading.tsx`
- [ ] Use `useAuth()` hook from Dev 1 to get current user

### Phase 2: Repository Display
- [ ] Implement `useRepos.ts` — fetch repos from `/api/repos` (Dev 4 builds API)
- [ ] Implement `repoStore.ts` with Zustand
- [ ] Build `RepoList.tsx` — grid/list of user's GitHub repos
- [ ] Build `RepoCard.tsx` — individual repo display (name, language, stars)
- [ ] Add search/filter functionality

### Phase 3: Session Creation
- [ ] Build `CreateSession.tsx` — modal/form for creating a session
- [ ] Implement `src/lib/session/create.ts` — POST to `/api/sessions`
- [ ] Handle branch selection for the repo
- [ ] Redirect to `/session/[sessionId]` after creation

### Phase 4: Session Management
- [ ] Implement `useSession.ts` — session state management
- [ ] Implement `sessionStore.ts` with Zustand
- [ ] Implement `src/lib/session/join.ts` — join via invite link
- [ ] Show active sessions on dashboard
- [ ] Session card with participant count, repo name, join button

---

## 🔌 Dependencies on Other Devs

| You Need | From | Status |
|---|---|---|
| `useAuth()` hook | Dev 1 | Contract defined ✅ |
| `/api/repos` endpoint | Dev 4 | Returns `ApiResponse<GitHubRepo[]>` |
| `/api/sessions` endpoint | Dev 4 | POST creates, GET lists sessions |
| `Session` type | Shared types | Already defined ✅ |

## 🤝 Integration Contract: `useSession` Hook

**Dev 3 depends on this hook** for the editor page. Do NOT change the return shape without discussion.

```typescript
export function useSession(sessionId: string) {
  return {
    session: Session | null,        // Current session data
    loading: boolean,               // Loading state
    error: string | null,           // Error message
    participants: Participant[],    // Active participants
    joinSession: () => Promise<void>,
    leaveSession: () => Promise<void>,
  }
}
```

---

## 🧪 How to Test

1. Log in (Dev 1's flow must work)
2. Visit `/dashboard` → should show repository list
3. Select a repo → should open create session modal
4. Create session → should redirect to `/session/[id]`
5. Visit dashboard again → should show active session

---

## ⚡ Golden Rules

1. **Never edit `layout.tsx` directly** — add providers to `AppProviders.tsx`
2. **Never push to `main`** — always push to `feature/dev2-dashboard` and create a PR
3. **Use `ApiResponse<T>` type** for all API calls — `const res: ApiResponse<GitHubRepo[]> = await fetch(...)`
4. **Announce in group chat** before editing any shared file
5. **Run `npm run lint`** before every commit
6. **Pull from `main`** daily to stay in sync
