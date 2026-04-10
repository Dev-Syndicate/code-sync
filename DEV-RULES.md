# ✏️ Dev 3 — Editor & Real-time Collaboration

> **Branch:** `feature/dev3-editor`
> **Owner:** Dev 3

---

## 🎯 Your Mission

Build the core collaborative code editor using Monaco Editor, Yjs CRDT, and WebRTC. This is the most technically complex feature — you are the collaboration engine.

---

## 📁 Files You OWN (only you edit these)

```
src/app/session/[sessionId]/page.tsx
src/app/session/[sessionId]/loading.tsx
src/components/editor/CodeEditor.tsx
src/components/editor/FileTree.tsx
src/components/editor/EditorTabs.tsx
src/components/editor/CollabCursor.tsx
src/components/session/SessionHeader.tsx
src/components/session/ParticipantList.tsx
src/components/session/ShareLink.tsx
src/components/session/CommitModal.tsx
src/hooks/useEditor.ts
src/hooks/useCollaboration.ts
src/hooks/useFileEditorTracking.ts
src/hooks/useConnectionStatus.ts
src/store/editorStore.ts
src/lib/yjs/provider.ts
src/lib/yjs/awareness.ts
```

## ⚠️ Files You Share (coordinate before editing)

```
src/components/providers/AppProviders.tsx   → Only if adding a new provider
src/types/*                                → Propose changes in group chat first
src/components/ui/*                        → Claim specific ones in group chat
.env.example                               → Add TURN server env vars
package.json                               → Only add YOUR dependencies
```

## 🚫 Files You Must NOT Touch

```
src/app/(auth)/*                           → Dev 1
src/components/auth/*                      → Dev 1
src/lib/firebase/*                         → Dev 1
src/middleware.ts                           → Dev 1
src/app/dashboard/*                        → Dev 2
src/components/dashboard/*                 → Dev 2
src/lib/session/*                          → Dev 2
src/components/chat/*                      → Dev 4
src/app/api/*                              → Dev 4
src/lib/github/*                           → Dev 4
```

---

## 📋 Task Checklist

### Phase 1: Packages (do this FIRST)
- [ ] Install `@monaco-editor/react` (Monaco Editor)
- [ ] Install `yjs` (CRDT)
- [ ] Install `y-webrtc` (WebRTC provider)
- [ ] Install `y-monaco` (Monaco ↔ Yjs binding)

### Phase 2: Monaco Editor
- [ ] Build `CodeEditor.tsx` with **lazy loading** (`next/dynamic`)
- [ ] Implement `editorStore.ts` with Zustand (tabs, active file, dirty state)
- [ ] Implement `useEditor.ts` hook
- [ ] Build `EditorTabs.tsx` — file tabs with dirty indicator
- [ ] Build `FileTree.tsx` — sidebar file explorer

### Phase 3: Real-time Collaboration (Yjs + WebRTC)
- [ ] Implement `src/lib/yjs/provider.ts` — WebRTC provider with TURN fallback
- [ ] Implement `src/lib/yjs/awareness.ts` — cursor & selection awareness
- [ ] Implement `useCollaboration.ts` — binds Yjs doc to Monaco
- [ ] Build `CollabCursor.tsx` — remote cursor labels + colors
- [ ] Implement `useConnectionStatus.ts` — track WebRTC connection state

### Phase 4: Session Page
- [ ] Build `session/[sessionId]/page.tsx` — main editor layout
- [ ] Build `SessionHeader.tsx` — repo name, branch, connection status
- [ ] Build `ParticipantList.tsx` — online users with cursor colors
- [ ] Build `ShareLink.tsx` — copy invite link modal

### Phase 5: Commit & Editor Tracking
- [ ] Build `CommitModal.tsx` — commit message input + file diff summary
- [ ] Implement `useFileEditorTracking.ts` — track who edits which files
- [ ] Wire CommitModal to call Dev 4's `/api/commits` endpoint

---

## 🔌 Dependencies on Other Devs

| You Need | From | Status |
|---|---|---|
| `useAuth()` hook | Dev 1 | Contract defined ✅ |
| `useSession()` hook | Dev 2 | Contract defined ✅ |
| `/api/commits` endpoint | Dev 4 | Accepts `CommitPayload` |
| Firebase Firestore helpers | Dev 1 | For presence/cursor tracking |
| TURN server credentials | Team Lead | Add to `.env.example` |

## 🤝 Integration Contract: `editorStore`

**Dev 4 depends on this** for the commit flow (reading dirty files).

```typescript
// editorStore must expose:
{
  tabs: EditorTab[],
  activeFile: string | null,
  getDirtyFiles: () => EditorTab[],  // Dev 4 calls this for commits
  getFileContent: (path: string) => string,
}
```

---

## 🔧 WebRTC TURN Server Config

```typescript
// src/lib/yjs/provider.ts
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },                    // Free STUN
  {
    urls: process.env.NEXT_PUBLIC_TURN_URL!,                    // Paid TURN
    username: process.env.NEXT_PUBLIC_TURN_USERNAME!,
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL!,
  },
]
```

---

## 🧪 How to Test

1. Log in → create session from dashboard (needs Dev 1 + 2)
2. Editor page loads with Monaco Editor
3. Open the same session in two browser tabs
4. Type in one tab → changes appear in the other in real-time
5. Cursor labels show other user's position
6. Disconnect internet briefly → reconnects and syncs

---

## ⚡ Golden Rules

1. **Lazy load Monaco** — use `next/dynamic` with `ssr: false`
2. **Never push to `main`** — always push to `feature/dev3-editor` and create a PR
3. **Destroy Yjs providers on unmount** — memory leaks will crash the app
4. **Use `CURSOR_COLORS` from types** — don't hardcode cursor colors
5. **Announce in group chat** before editing any shared file
6. **Run `npm run lint`** before every commit
7. **Pull from `main`** daily to stay in sync
