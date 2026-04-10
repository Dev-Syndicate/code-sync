# 🔐 Dev 1 — Authentication & Firebase Setup

> **Branch:** `feature/dev1-auth`
> **Owner:** Dev 1

---

## 🎯 Your Mission

Build the complete authentication flow using GitHub OAuth and set up Firebase infrastructure that the entire team depends on.

---

## 📁 Files You OWN (only you edit these)

```
src/app/(auth)/login/page.tsx
src/app/(auth)/callback/page.tsx
src/components/auth/LoginButton.tsx
src/components/auth/UserAvatar.tsx
src/components/auth/AuthGuard.tsx
src/components/providers/AuthProvider.tsx
src/components/providers/ToastProvider.tsx
src/hooks/useAuth.ts
src/store/authStore.ts
src/store/toastStore.ts
src/lib/firebase/config.ts
src/lib/firebase/auth.ts
src/lib/firebase/firestore.ts
src/lib/firebase/storage.ts
src/lib/firebase/presence.ts
src/lib/firebase/models/user.ts
src/lib/firebase/models/session.ts
src/lib/firebase/models/presence.ts
src/middleware.ts
```

## ⚠️ Files You Share (coordinate before editing)

```
src/components/providers/AppProviders.tsx   → Add your providers here
src/types/*                                → Propose changes in group chat first
src/app/layout.tsx                         → DO NOT edit directly, use AppProviders
src/components/ui/*                        → Claim specific ones in group chat
.env.example                               → Add new vars, don't remove existing
package.json                               → Only add YOUR dependencies
```

## 🚫 Files You Must NOT Touch

```
src/app/dashboard/*                        → Dev 2
src/components/dashboard/*                 → Dev 2
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

### Phase 1: Firebase Setup
- [ ] Install `firebase` and `firebase-admin`
- [ ] Configure `src/lib/firebase/config.ts` with environment variables
- [ ] Set up Firestore, Auth, and Storage instances
- [ ] Create `.env.local` from `.env.example` with real Firebase keys

### Phase 2: GitHub OAuth
- [ ] Implement `src/middleware.ts` (already stubbed — add cookie validation)
- [ ] Build login page with GitHub OAuth button
- [ ] Build callback page to handle OAuth redirect

### Phase 3: Auth State
- [ ] Implement `authStore.ts` with Zustand (install zustand)
- [ ] Implement `useAuth.ts` hook — **THIS IS A CONTRACT** (see below)
- [ ] Implement `AuthProvider.tsx` — wraps app with auth listener
- [ ] Implement `AuthGuard.tsx` — client-side route protection (Layer 2)

### Phase 4: Toast System
- [ ] Implement `toastStore.ts` with Zustand
- [ ] Build `Toast.tsx` UI component
- [ ] Implement `ToastProvider.tsx`
- [ ] Wire providers into `AppProviders.tsx`

### Phase 5: Firestore Models
- [ ] Implement `models/user.ts` — createUser, getUser, updateUser
- [ ] Implement `models/session.ts` — createSession, getSession, joinSession
- [ ] Implement `models/presence.ts` — setPresence, onPresenceChange

### Phase 6: User Components
- [ ] Build `LoginButton.tsx`
- [ ] Build `UserAvatar.tsx` with GitHub avatar + fallback

---

## 🤝 Integration Contract: `useAuth` Hook

**Dev 2, 3, and 4 all depend on this hook.** Do NOT change the return shape without team discussion.

```typescript
export function useAuth() {
  return {
    user: User | null,          // Current logged-in user
    loading: boolean,           // Auth state loading
    isAuthenticated: boolean,   // Quick check
    login: () => Promise<void>, // Trigger GitHub OAuth
    logout: () => Promise<void> // Sign out + clear cookie
  }
}
```

---

## 🧪 How to Test

1. Run `npm run dev`
2. Visit `http://localhost:3000` → should redirect to `/login`
3. Click GitHub login → should redirect to GitHub → callback → `/dashboard`
4. Visit `/dashboard` without login → should redirect to `/login`
5. Visit `/login` while logged in → should redirect to `/dashboard`

---

## ⚡ Golden Rules

1. **Never edit `layout.tsx` directly** — add providers to `AppProviders.tsx`
2. **Never push to `main`** — always push to `feature/dev1-auth` and create a PR
3. **Announce in group chat** before editing any shared file
4. **Run `npm run lint`** before every commit
5. **Pull from `main`** daily to stay in sync
