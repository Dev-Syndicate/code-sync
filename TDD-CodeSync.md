# Technical Design Document (TDD)
## CodeSync — Collaborative Coding Platform

**Version:** 1.0  
**Project Code:** SE003  
**Date:** April 2026  
**Team:** Dev 1 · Dev 2 · Dev 3 · Dev 4  

---

## 1. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend Framework | Next.js 14 (App Router) | UI + Serverless API |
| UI Library | React 18 | Component system |
| Language | TypeScript | Type safety across the entire codebase |
| Styling | Tailwind CSS + CSS Variables | Theme system |
| Code Editor | Monaco Editor (`@monaco-editor/react`) | VS Code in browser |
| Collaboration Engine | Yjs (CRDT) | Conflict-free real-time sync |
| P2P Sync | WebRTC + y-webrtc | Peer-to-peer code sync |
| Signaling & State | Firebase Firestore | Session, presence, chat, signaling |
| Authentication | GitHub OAuth + Firebase Auth | User login |
| User Storage | Firebase Firestore | User profiles |
| Draft Storage | Firebase Storage | Uncommitted file backups |
| Version Control | GitHub API | Load repos, commit, push |
| Serverless Backend | Next.js API Routes | GitHub OAuth + token handling |
| State Management | Zustand | Global client state |
| Deployment | Vercel | Hosting + edge functions |

---

## 2. System Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────┐
│                USER BROWSER                 │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Next.js  │  │  Monaco  │  │   Yjs    │  │
│  │  + React │  │  Editor  │  │  CRDT    │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                     ↕              ↕         │
│           ┌─────────────────────────────┐   │
│           │    WebRTC (P2P sync)        │   │
│           └─────────────────────────────┘   │
└───────────────┬────────────────┬────────────┘
                │                │
                ▼                ▼
 ┌──────────────────────┐  ┌────────────────────────┐
 │      FIREBASE        │  │   NEXT.JS API ROUTES   │
 │                      │  │      (Server)          │
 │  Firestore:          │  │                        │
 │  ├─ sessions/        │  │  /api/auth/github      │
 │  ├─ users/           │  │  /api/repos            │
 │  ├─ presence/        │  │  /api/session          │
 │  └─ chat/            │  │  /api/github/commit    │
 │                      │  │  /api/github/push      │
 │  Auth:               │  └────────────┬───────────┘
 │  └─ GitHub OAuth     │               │
 │                      │               ▼
 │  Storage:            │  ┌────────────────────────┐
 │  └─ drafts/          │  │      GITHUB API        │
 └──────────────────────┘  │                        │
                           │  - List repos          │
                           │  - Load files          │
                           │  - Commit changes      │
                           │  - Push to branch      │
                           └────────────────────────┘
```

### 2.2 Real-Time Collaboration Flow

```
User A types in Monaco Editor
          ↓
Yjs captures the change (CRDT delta)
          ↓
WebRTC broadcasts delta to all peers
(direct, no server, ~10–50ms)
          ↓
User B + C + D receive delta
          ↓
Their Yjs instances merge the change
          ↓
Monaco editor updates on their screen
          ↓
All users see identical code ✅
```

### 2.3 Version Control Strategy

```
Level 1 — Live (Yjs, every keystroke)
  → Real-time sync via WebRTC
  → Zero conflicts, automatic merge

Level 2 — Draft (Firebase Storage, every 2 min)
  → Auto-save snapshot of current code
  → Crash recovery

Level 3 — Committed (GitHub)
  → User triggers commit manually
  → Permanent history, full rollback
  → Draft deleted after successful commit
```

### 2.4 Session Lifecycle

```
Owner selects repo
      ↓
Session created in Firestore:
{
  id: "uuid-v4",
  repo: "repo-name",
  repoUrl: "github.com/user/repo",
  owner: "userId",
  participants: ["userId"],
  files: [...],
  createdAt: timestamp,
  active: true
}
      ↓
Shareable link generated:
→ yourapp.com/session/{sessionId}
      ↓
Collaborators join → added to participants[]
      ↓
WebRTC signaling via Firestore
(peers find each other)
      ↓
Yjs sync begins (P2P)
      ↓
Owner commits → GitHub API called
      ↓
Owner closes session → active: false
```

---

## 3. Firebase Data Architecture

### 3.1 Firestore Collections

```
/users/{userId}
  ├─ githubId: string
  ├─ username: string
  ├─ name: string
  ├─ avatar: string (URL)
  ├─ email: string
  ├─ createdAt: timestamp
  └─ updatedAt: timestamp

/users/{userId}/private/tokens         ← SERVER-ONLY (secured by Firestore rules)
  └─ accessToken: string (encrypted)
  ⚠️ Only readable by server-side API routes, never exposed to client

/sessions/{sessionId}
  ├─ repo: string                      (repository name)
  ├─ repoOwner: string                 (GitHub username of repo owner)
  ├─ repoUrl: string                   (full GitHub URL)
  ├─ branch: string (default: "main")
  ├─ owner: string (userId)
  ├─ participants: map<userId, {        (map for quick lookup + display)
  │     username: string,
  │     avatar: string,
  │     color: string,                  (unique cursor color, e.g. "#ef4444")
  │     joinedAt: timestamp
  │   }>
  ├─ files: FileEntry[]                (see type below)
  ├─ active: boolean
  ├─ maxParticipants: number (default: 4)
  ├─ createdAt: timestamp
  ├─ closedAt: timestamp | null
  └─ lastDraftAt: timestamp | null

  FileEntry = {
    path: string,                       // e.g. "src/index.ts"
    language: string,                   // e.g. "typescript"
    sha: string                         // GitHub blob SHA for change detection
  }

/sessions/{sessionId}/chat/{messageId}  ← SUBCOLLECTION
  ├─ userId: string
  ├─ username: string                   (denormalized for fast rendering)
  ├─ avatar: string                     (denormalized for fast rendering)
  ├─ message: string
  ├─ type: "message" | "system"         (system = join/leave/commit events)
  └─ timestamp: timestamp

/sessions/{sessionId}/fileEditors/{filename}
  ├─ filename: string                   ← e.g. "auth/login.tsx"
  └─ editors: array
       └─ {
            userId: string
            username: string            ← GitHub username
            githubName: string          ← Full name
            email: string               ← For co-author tag
            avatar: string
            editedAt: timestamp         ← Last edit time
          }

/presence/{sessionId}/{userId}
  ├─ online: boolean
  ├─ username: string
  ├─ avatar: string
  ├─ color: string                      (cursor color, matches session participant color)
  ├─ cursorFile: string                 (which file the user is editing)
  ├─ cursorLine: number                 (line number in editor)
  ├─ cursorColumn: number               (column number in editor)
  └─ lastSeen: timestamp
```

> **Note on denormalization:** `username` and `avatar` are intentionally duplicated in chat messages and presence documents. This is a standard Firestore pattern to avoid extra reads. If a user changes their GitHub avatar, old chat messages will retain the old avatar — this is acceptable.

> **Note on fileEditors:** When a user edits any file, their details are added to that file's `fileEditors` document. Duplicates are prevented — each user appears only once per file. This data is used at commit time to auto-generate co-author credits.

### 3.2 Firebase Storage Structure

```
/drafts/{sessionId}/{filename}
  → Auto-saved every 2 minutes
  → Deleted after successful commit

/drafts/{sessionId}/_meta.json         ← Draft metadata
  {
    "lastSavedAt": timestamp,
    "savedBy": userId,
    "fileCount": number,
    "files": ["src/index.ts", "src/app.ts", ...]
  }
```

---

## 4. GitHub OAuth Flow

```
1. User clicks "Login with GitHub"

2. Redirect to:
   https://github.com/login/oauth/authorize
   ?client_id={GITHUB_CLIENT_ID}
   &redirect_uri={APP_URL}/api/auth/github/callback
   &scope=repo,read:user

3. User approves on GitHub

4. GitHub redirects to:
   /api/auth/github/callback?code=xxx

5. Next.js API route:
   → Exchanges code for access_token
   → Fetches user profile from GitHub API
   → Saves user to Firestore
   → Creates Firebase custom token
   → Redirects to /dashboard

6. Access token stored securely:
   → In Firestore (server-accessible)
   → Never exposed to browser directly
```

**Scopes requested:**

| Scope | Reason |
|---|---|
| `read:user` | Get user profile, name, avatar |
| `repo` | Read/write to their repositories |

---

## 5. File Editor Tracking & Co-Author Commits

### 5.1 How It Works

Every time a user edits a file, their details are recorded in Firestore under that file. At commit time, the app reads who edited which files and automatically builds the correct co-author credits for each commit.

```
John edits auth/login.jsx
→ Firestore: fileEditors/auth-login.jsx → [John]

Sarah also edits auth/login.jsx
→ Firestore: fileEditors/auth-login.jsx → [John, Sarah]

Mike edits chat/panel.jsx
→ Firestore: fileEditors/chat-panel.jsx → [Mike]

Anyone clicks "Commit & Push"
→ App reads all fileEditors
→ Collects unique editors per file
→ Builds commit message with co-authors
→ GitHub credits everyone ✅
```

### 5.2 Tracking Flow

```
User opens a file in Monaco Editor
        ↓
useFileEditorTracking hook fires
        ↓
Checks Firestore: is this user already
in fileEditors for this file?
        ↓
NO → adds user to editors array
YES → updates editedAt timestamp only
        ↓
Firestore document updated silently
(user never sees this happening)
```

### 5.3 Commit Message Auto-Builder

```
Commit & Push clicked
        ↓
Fetch all fileEditors for this session
        ↓
For each changed file:
  → Get editors list
  → Collect unique editors across all files
        ↓
Remove the committer from co-authors list
(committer is already credited as author)
        ↓
Build commit message:

  feat: update login and chat panel

  Co-authored-by: Sarah Lee <sarah@users.noreply.github.com>
  Co-authored-by: Mike Chen <mike@users.noreply.github.com>
        ↓
Send to /api/github/commit
        ↓
GitHub credits all three people ✅
```

### 5.4 Code — useFileEditorTracking.ts (Dev 3 owns)

```ts
// hooks/useFileEditorTracking.ts
import { useEffect } from 'react'
import { db } from '@/lib/firebase/config'
import {
  doc, getDoc, setDoc, arrayUnion, serverTimestamp
} from 'firebase/firestore'
import { useAuthStore } from '@/store/authStore'

export function useFileEditorTracking(sessionId: string | null, activeFile: string | null): void {
  const { user } = useAuthStore()

  useEffect(() => {
    if (!sessionId || !activeFile || !user) return

    // Sanitize filename for Firestore key (no slashes allowed)
    const fileKey = activeFile.replace(/\//g, '-').replace(/\./g, '_')

    const trackEdit = async () => {
      const ref = doc(db, 'sessions', sessionId, 'fileEditors', fileKey)
      const snap = await getDoc(ref)

      const editorEntry = {
        userId:     user.uid,
        username:   user.username,
        githubName: user.name,
        email:      user.email,
        avatar:     user.avatar,
        editedAt:   serverTimestamp(),
      }

      if (!snap.exists()) {
        // First editor on this file
        await setDoc(ref, {
          filename: activeFile,
          editors: [editorEntry],
        })
      } else {
        const existing = snap.data().editors || []
        const alreadyTracked = existing.some((e: { userId: string }) => e.userId === user.uid)

        if (!alreadyTracked) {
          // New editor — add to array
          await setDoc(ref, {
            filename: activeFile,
            editors: arrayUnion(editorEntry),
          }, { merge: true })
        }
        // If already tracked, do nothing (avoid unnecessary writes)
      }
    }

    // Debounce — only track after 2 seconds of editing
    const timer = setTimeout(trackEdit, 2000)
    return () => clearTimeout(timer)

  }, [sessionId, activeFile, user])
}
```

### 5.5 Code — buildCommitMessage.ts (Dev 4 owns)

```ts
// lib/github/buildCommitMessage.ts
import { db } from '@/lib/firebase/config'
import { collection, getDocs } from 'firebase/firestore'

interface EditorEntry {
  userId: string
  username: string
  githubName: string
  email: string
  avatar: string
}

export async function buildCommitMessage(
  sessionId: string,
  committerId: string,
  userMessage: string
): Promise<string> {
  // 1. Fetch all fileEditors for this session
  const editorsRef = collection(db, 'sessions', sessionId, 'fileEditors')
  const snapshot = await getDocs(editorsRef)

  // 2. Collect all unique editors across all files
  const editorMap = new Map<string, EditorEntry>()

  snapshot.forEach(doc => {
    const { editors } = doc.data()
    editors.forEach((editor: EditorEntry) => {
      // Don't add the committer — they're already the author
      if (editor.userId !== committerId) {
        editorMap.set(editor.userId, editor)
      }
    })
  })

  // 3. Build co-author lines
  // GitHub requires: Co-authored-by: Name <email>
  // Use noreply email format if no real email available
  const coAuthorLines = Array.from(editorMap.values())
    .map(editor => {
      const email = editor.email || 
        `${editor.username}@users.noreply.github.com`
      return `Co-authored-by: ${editor.githubName} <${email}>`
    })
    .join('\n')

  // 4. Build final commit message
  // GitHub reads co-authors from the commit body (after blank line)
  const message = coAuthorLines
    ? `${userMessage}\n\n${coAuthorLines}`
    : userMessage

  return message
}

/* Output example:
  "feat: update login page and chat panel

  Co-authored-by: Sarah Lee <sarah@users.noreply.github.com>
  Co-authored-by: Mike Chen <mike@users.noreply.github.com>"
*/
```

### 5.6 Code — commit API route (Dev 4 owns)

```ts
// app/api/commits/route.ts
import { NextRequest } from 'next/server'
import { buildCommitMessage } from '@/lib/github/buildCommitMessage'

interface CommitRequestBody {
  sessionId: string
  files: { path: string; content: string }[]
  userMessage: string
  committerId: string
  repoOwner: string
  repoName: string
}

export async function POST(req: NextRequest) {
  const { sessionId, files, userMessage, committerId, repoOwner, repoName }: CommitRequestBody
    = await req.json()

  // Auto-build commit message with co-authors
  const commitMessage = await buildCommitMessage(
    sessionId,
    committerId,
    userMessage
  )

  // Get committer's GitHub token from Firestore (server-only subcollection)
  const token = await getTokenForUser(committerId)

  // Commit each file to GitHub
  for (const file of files) {
    await commitFileToGitHub({
      token,
      repoOwner,
      repoName,
      path: file.path,
      content: file.content,
      message: commitMessage,
    })
  }

  // Clean up draft after successful commit
  await deleteDraftFromStorage(sessionId)

  return Response.json({ success: true, message: commitMessage })
}
```

### 5.7 What GitHub Shows

After the commit, GitHub displays:

```
feat: update login page                    ← commit title
                                           
Co-authored-by: Sarah Lee <sarah@...>      ← in commit body
Co-authored-by: Mike Chen <mike@...>

────────────────────────────────────────
Contributors shown on commit:

  🟢 John (committer)
  🟢 Sarah (co-author)
  🟢 Mike  (co-author)

All three get contribution squares on their GitHub profiles ✅
```

---

## 6. UI Theme System

### 5.1 Global CSS Variables (globals.css)

All colors, spacing, and fonts are defined as CSS custom properties. Changing one variable reflects across ALL components automatically.

```css
/* app/globals.css */

:root {
  /* ─── Brand Colors ─── */
  --color-primary:        #2563eb;   /* Change this → whole UI updates */
  --color-primary-hover:  #1d4ed8;
  --color-primary-light:  #eff6ff;
  --color-primary-dark:   #1e3a8a;

  --color-accent:         #10b981;
  --color-accent-hover:   #059669;
  --color-danger:         #ef4444;
  --color-warning:        #f59e0b;
  --color-success:        #22c55e;

  /* ─── Background ─── */
  --bg-base:              #0f172a;
  --bg-surface:           #1e293b;
  --bg-elevated:          #334155;
  --bg-overlay:           rgba(0, 0, 0, 0.6);

  /* ─── Text ─── */
  --text-primary:         #f1f5f9;
  --text-secondary:       #94a3b8;
  --text-muted:           #475569;
  --text-inverse:         #0f172a;

  /* ─── Borders ─── */
  --border-default:       #334155;
  --border-subtle:        #1e293b;
  --border-strong:        #475569;

  /* ─── Editor ─── */
  --editor-bg:            #0d1117;
  --editor-sidebar:       #161b22;
  --editor-tab-active:    #1e293b;
  --editor-tab-inactive:  #0d1117;

  /* ─── Spacing Scale ─── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;

  /* ─── Border Radius ─── */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-full: 9999px;

  /* ─── Typography ─── */
  --font-sans:  'Inter', system-ui, sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', monospace;

  --text-xs:   12px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-lg:   18px;
  --text-xl:   20px;
  --text-2xl:  24px;
  --text-3xl:  30px;

  /* ─── Shadows ─── */
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.3);
  --shadow-md:  0 4px 6px rgba(0,0,0,0.4);
  --shadow-lg:  0 10px 15px rgba(0,0,0,0.5);

  /* ─── Transitions ─── */
  --transition-fast:   150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow:   400ms ease;

  /* ─── Z-index Scale ─── */
  --z-base:    0;
  --z-above:   10;
  --z-modal:   100;
  --z-toast:   200;
  --z-tooltip: 300;
}
```

### 6.2 Tailwind Config (tailwind.config.ts)

Wire the CSS variables into Tailwind so you can use them as utility classes:

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:  'var(--color-primary)',
        accent:   'var(--color-accent)',
        danger:   'var(--color-danger)',
        surface:  'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        border:   'var(--border-default)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
    },
  },
};

export default config;
```

### 5.3 How to Change the Theme

To change the primary color across the ENTIRE app:

```css
/* Just change this one line in globals.css */
--color-primary: #7c3aed;   /* Now everything is purple */
```

To support a light mode in future:

```css
[data-theme="light"] {
  --bg-base:     #ffffff;
  --bg-surface:  #f8fafc;
  --text-primary: #0f172a;
  /* ... override only what changes */
}
```

---

## 7. Folder Architecture

### 7.1 Full Structure

```
codesync/
│
├── app/                              # Next.js App Router
│   ├── (auth)/                       # ── DEV 1 ──
│   │   ├── login/
│   │   │   └── page.tsx              # Login page
│   │   └── callback/
│   │       └── page.tsx              # OAuth callback handler
│   │
│   ├── dashboard/                    # ── DEV 2 ──
│   │   ├── page.tsx                  # Repo list page
│   │   └── loading.tsx
│   │
│   ├── session/                      # ── DEV 3 ──
│   │   └── [sessionId]/
│   │       ├── page.tsx              # Main editor page
│   │       └── loading.tsx
│   │
│   ├── api/                          # ── DEV 4 ──
│   │   ├── auth/
│   │   │   └── github/
│   │   │       ├── route.ts          # Start GitHub OAuth
│   │   │       └── callback/
│   │   │           └── route.ts      # OAuth callback handler
│   │   ├── repos/
│   │   │   └── route.ts              # Fetch user repos
│   │   ├── sessions/
│   │   │   └── route.ts              # Create/get session
│   │   └── commits/
│   │       └── route.ts              # Commit + push to GitHub
│   │
│   ├── layout.tsx                    # Root layout — DEV 1 sets up
│   ├── page.tsx                      # Landing page — DEV 1
│   └── globals.css                   # Theme variables — DEV 1 sets up
│
├── components/
│   ├── auth/                         # ── DEV 1 ──
│   │   ├── LoginButton.tsx
│   │   ├── UserAvatar.tsx
│   │   └── AuthGuard.tsx             # Client-side route protection
│   │
│   ├── dashboard/                    # ── DEV 2 ──
│   │   ├── RepoList.tsx
│   │   ├── RepoCard.tsx
│   │   └── CreateSession.tsx
│   │
│   ├── session/                      # ── DEV 3 ──
│   │   ├── SessionHeader.tsx         # Top bar with session info
│   │   ├── ParticipantList.tsx       # Online users sidebar
│   │   ├── ShareLink.tsx             # Copy link modal
│   │   └── CommitModal.tsx           # Commit message modal
│   │
│   ├── editor/                       # ── DEV 3 ──
│   │   ├── CodeEditor.tsx            # Monaco wrapper
│   │   ├── FileTree.tsx              # Sidebar file browser
│   │   ├── EditorTabs.tsx            # Open file tabs
│   │   └── CollabCursor.tsx          # Remote cursors
│   │
│   ├── chat/                         # ── DEV 4 ──
│   │   ├── ChatPanel.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   │
│   └── ui/                           # ── SHARED (discuss before editing) ──
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Loader.tsx
│       ├── Avatar.tsx
│       ├── Badge.tsx
│       └── Toast.tsx
│
├── lib/
│   ├── firebase/                     # ── DEV 1 ──
│   │   ├── config.ts                 # Firebase init
│   │   ├── auth.ts                   # Auth helpers
│   │   ├── firestore.ts              # Firestore helpers
│   │   ├── storage.ts                # Storage helpers
│   │   └── models/                   # Firestore data access layer
│   │       ├── user.ts               # createUser(), getUser(), updateUser()
│   │       ├── session.ts            # createSession(), getSession(), joinSession()
│   │       └── presence.ts           # setPresence(), onPresenceChange()
│   │
│   ├── github/                       # ── DEV 4 ──
│   │   ├── api.ts                    # GitHub API base client
│   │   ├── repos.ts                  # Repo fetching
│   │   ├── commits.ts                # Commit + push logic
│   │   └── buildCommitMessage.ts     # Auto co-author builder
│   │
│   ├── yjs/                          # ── DEV 3 ──
│   │   ├── provider.ts               # Yjs + WebRTC setup
│   │   └── awareness.ts              # Cursor awareness
│   │
│   └── session/                      # ── DEV 2 ──
│       ├── create.ts                 # Session creation logic
│       └── join.ts                   # Session join logic
│
├── hooks/
│   ├── useAuth.ts                    # ── DEV 1 ──
│   ├── useRepos.ts                   # ── DEV 2 ──
│   ├── useSession.ts                 # ── DEV 2 ──
│   ├── useEditor.ts                  # ── DEV 3 ──
│   ├── useCollaboration.ts           # ── DEV 3 ──
│   ├── useFileEditorTracking.ts      # ── DEV 3 ── tracks who edits what file
│   └── useChat.ts                    # ── DEV 4 ──
│
├── store/                            # Zustand global state
│   ├── authStore.ts                  # ── DEV 1 ──
│   ├── repoStore.ts                  # ── DEV 2 ──
│   ├── sessionStore.ts               # ── DEV 2 ──
│   └── editorStore.ts                # ── DEV 3 ──
│
├── types/                            # Shared TypeScript types
│   ├── user.ts                       # User, GitHubProfile interfaces
│   ├── session.ts                    # Session, Participant interfaces
│   ├── editor.ts                     # FileEntry, Tab interfaces
│   ├── chat.ts                       # ChatMessage interface
│   └── github.ts                     # Repo, Commit interfaces
│
├── public/
│   └── icons/
│
├── middleware.ts                      # Auth route protection (server-side)
├── .env.local                        # ❌ Never commit
├── .env.example                      # ✅ Commit this (no real values)
├── .gitignore
├── tsconfig.json                     # TypeScript config
├── next.config.ts                    # DEV 1 sets up
├── tailwind.config.ts                # DEV 1 sets up
└── package.json                      # DEV 1 manages
```

---

## 8. Team Ownership

| Developer | Owns | Responsible For |
|---|---|---|
| Dev 1 | `app/(auth)/`, `components/auth/`, `lib/firebase/`, `store/authStore.ts`, `hooks/useAuth.ts`, `middleware.ts` | Auth, Firebase setup, project init, globals.css, theme, route protection |
| Dev 2 | `app/dashboard/`, `components/dashboard/`, `lib/session/`, `store/repoStore.ts`, `store/sessionStore.ts`, `hooks/useRepos.ts`, `hooks/useSession.ts` | Dashboard, repo list, session creation |
| Dev 3 | `app/session/`, `components/session/`, `components/editor/`, `lib/yjs/`, `store/editorStore.ts`, `hooks/useEditor.ts`, `hooks/useCollaboration.ts`, `hooks/useFileEditorTracking.ts` | Editor, Yjs, WebRTC, real-time sync, file editor tracking |
| Dev 4 | `app/api/`, `components/chat/`, `lib/github/`, `hooks/useChat.ts` | All API routes, GitHub integration, chat, co-author commits |

---

## 9. Git Workflow

### 9.1 Branch Strategy

```
main              ← Production only. Never commit directly.
  └── develop     ← Integration branch. All features merge here.
        ├── feature/dev1-auth
        ├── feature/dev2-dashboard
        ├── feature/dev3-editor
        └── feature/dev4-api
```

### 9.2 Daily Workflow

```
1. Pull latest develop before starting work
   git checkout develop
   git pull origin develop

2. Switch to your branch
   git checkout feature/dev1-auth

3. Merge develop into your branch (keep up to date)
   git merge develop

4. Do your work, commit often
   git add .
   git commit -m "feat: add GitHub login button"

5. Push your branch
   git push origin feature/dev1-auth

6. Open Pull Request → develop (not main)

7. One teammate reviews and approves

8. Merge into develop ✅
```

### 9.3 Commit Message Format

```
feat:     New feature
fix:      Bug fix
style:    CSS/UI changes only
refactor: Code cleanup, no behavior change
docs:     Documentation
chore:    Config, deps, tooling

Examples:
feat: add Monaco editor with Yjs binding
fix: GitHub token not refreshing after expiry
style: update button hover color to use CSS variable
```

### 9.4 Golden Rules

```
Rule 1 — Own your folder
  Never edit another dev's files without telling them

Rule 2 — Shared files (coordinate before touching)
  app/globals.css       → Dev 1 owns
  app/layout.tsx        → Dev 1 owns
  middleware.ts         → Dev 1 owns
  components/ui/        → Discuss in group chat first
  package.json          → Dev 1 manages all installs
  types/                → Only ADD new types/files, never remove existing ones

Rule 3 — Never commit to main directly
  Always go: your branch → develop → main

Rule 4 — Never commit secrets
  .env.local stays local
  Share secrets via WhatsApp only

Rule 5 — Pull before you push
  Always git pull before opening a PR
```

---

## 10. Environment Variables

### .env.example (commit this file)

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# GitHub OAuth (server only — no NEXT_PUBLIC prefix)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Important:** Variables without `NEXT_PUBLIC_` are server-only and never exposed to the browser. GitHub secrets must never have the `NEXT_PUBLIC_` prefix.

---

## 11. Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Language | TypeScript (not JavaScript) | Type safety, better DX, catches bugs at compile time |
| Real-time sync | Yjs + WebRTC | CRDT = no conflicts, P2P = no server cost |
| Signaling | Firebase Firestore | Already in stack, simple to implement |
| Code editor | Monaco (not CodeMirror) | VS Code engine, better DX for students |
| Auth | GitHub OAuth only | Users already have GitHub, no extra signup |
| Route protection | middleware.ts + AuthGuard | Server-side blocks before page load + client-side fallback |
| Backend | Next.js API Routes | No separate server needed, Vercel deploys free |
| State | Zustand (not Redux) | Simpler, less boilerplate, good for 4 devs |
| Draft storage | Firebase Storage | Already in stack, avoids adding Cloudinary |
| Co-author credits | fileEditors subcollection | Auto-generate GitHub co-author tags at commit time |

---

## 12. Security Checklist

- [ ] GitHub `client_secret` only in server-side API routes
- [ ] Access tokens in server-only subcollection (`/users/{id}/private/tokens`), never in localStorage
- [ ] Firestore rules block client access to `/users/{id}/private/*`
- [ ] `middleware.ts` blocks unauthenticated access to `/dashboard` and `/session` routes
- [ ] `AuthGuard` component provides client-side fallback protection
- [ ] `.env.local` in `.gitignore`
- [ ] Firebase Security Rules set (only authenticated users read/write)
- [ ] Session participants validated before allowing edits
- [ ] All API routes validate auth tokens before processing requests
- [ ] `maxParticipants` enforced when joining a session

---

## 13. Firestore Security Rules

> **IMPORTANT:** These rules MUST be deployed before going live. The `/private/` subcollection is locked — only server-side API routes (using Firebase Admin SDK) can read tokens.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ──
    function isAuth() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isSessionParticipant(sessionId) {
      return request.auth.uid in
        get(/databases/$(database)/documents/sessions/$(sessionId)).data.participants;
    }

    // ── Users ──
    match /users/{userId} {
      allow read:   if isAuth();
      allow create: if isAuth() && isOwner(userId);
      allow update: if isAuth() && isOwner(userId);
      allow delete: if false;                       // Users cannot delete accounts from client

      // 🔒 SERVER-ONLY — tokens subcollection
      // Only readable via Firebase Admin SDK (API routes)
      // Client reads/writes are ALWAYS denied
      match /private/{document} {
        allow read, write: if false;
      }
    }

    // ── Sessions ──
    match /sessions/{sessionId} {
      allow read:   if isAuth();
      allow create: if isAuth();
      allow update: if isAuth() &&
        request.auth.uid in resource.data.participants;
      allow delete: if isAuth() &&
        resource.data.owner == request.auth.uid;     // Only session owner can delete

      // Chat — anyone authenticated can read; only participants can write
      match /chat/{messageId} {
        allow read:   if isAuth();
        allow create: if isAuth() && isSessionParticipant(sessionId);
        allow update, delete: if false;              // Chat messages are immutable
      }

      // File Editors — tracking who edits what
      match /fileEditors/{fileId} {
        allow read:  if isAuth();
        allow write: if isAuth() && isSessionParticipant(sessionId);
      }
    }

    // ── Presence ──
    match /presence/{sessionId}/{userId} {
      allow read:  if isAuth();
      allow write: if isAuth() && isOwner(userId);   // Users can only update their own presence
    }
  }
}
```

---

## 14. TypeScript Interfaces

All shared types live in `types/`. Every dev imports from here — never define inline types for shared data.

> **Convention:** Firestore documents use `Timestamp` from Firebase. When converting for UI display, use `.toDate()` to get a JS `Date`. Interfaces ending with `Doc` represent the raw Firestore document shape. Interfaces without `Doc` are the app-level representation.

### 14.1 `types/user.ts`

```ts
import type { Timestamp } from 'firebase/firestore'

// ── Firestore document shape ──
export interface UserDoc {
  githubId: string
  username: string
  name: string
  avatar: string
  email: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── App-level type (after converting timestamps) ──
export interface User {
  uid: string               // Firestore document ID
  githubId: string
  username: string
  name: string
  avatar: string
  email: string
  createdAt: Date
  updatedAt: Date
}

// ── Input type for creating a new user ──
// Omits fields that Firestore auto-generates
export type CreateUserInput = Omit<UserDoc, 'createdAt' | 'updatedAt'>

// ── What the GitHub API returns (raw, before transforming to User) ──
export interface GitHubProfile {
  id: number
  login: string
  name: string | null
  avatar_url: string
  email: string | null
  bio: string | null
  public_repos: number
}

// ── Server-only token document (/users/{id}/private/tokens) ──
export interface UserTokenDoc {
  accessToken: string       // Encrypted GitHub access token
}
```

### 14.2 `types/session.ts`

```ts
import type { Timestamp } from 'firebase/firestore'

// ── Cursor color palette ──
// Used to assign unique colors to participants (max 8)
export const CURSOR_COLORS = [
  '#ef4444',  // red
  '#3b82f6',  // blue
  '#22c55e',  // green
  '#f59e0b',  // amber
  '#a855f7',  // purple
  '#ec4899',  // pink
  '#14b8a6',  // teal
  '#f97316',  // orange
] as const

export type CursorColor = typeof CURSOR_COLORS[number]

// ── Participant in a session ──
export interface Participant {
  username: string
  avatar: string
  color: CursorColor        // Unique cursor color from CURSOR_COLORS
  joinedAt: Timestamp
}

// ── File loaded from GitHub into the session ──
export interface FileEntry {
  path: string              // e.g. "src/index.ts"
  language: string          // e.g. "typescript"
  sha: string               // GitHub blob SHA for change detection
}

// ── Session Firestore document ──
export interface SessionDoc {
  repo: string
  repoOwner: string
  repoUrl: string
  branch: string
  owner: string             // userId of session creator
  participants: Record<string, Participant>
  files: FileEntry[]
  active: boolean
  maxParticipants: number   // Default: 4
  createdAt: Timestamp
  closedAt: Timestamp | null
  lastDraftAt: Timestamp | null
}

// ── App-level session type (with document ID) ──
export interface Session extends SessionDoc {
  id: string                // Firestore document ID
}

// ── Input for creating a new session ──
export type CreateSessionInput = Pick<
  SessionDoc,
  'repo' | 'repoOwner' | 'repoUrl' | 'branch' | 'owner' | 'files'
> & {
  maxParticipants?: number  // Defaults to 4 if not provided
}

// ── File editor tracking ──
export interface EditorEntry {
  userId: string
  username: string
  githubName: string
  email: string
  avatar: string
  editedAt: Timestamp
}

export interface FileEditorDoc {
  filename: string          // Original file path, e.g. "src/app.ts"
  editors: EditorEntry[]
}
```

### 14.3 `types/chat.ts`

```ts
import type { Timestamp } from 'firebase/firestore'

export type MessageType = 'message' | 'system'

// ── System event subtypes (for type === 'system') ──
export type SystemEventType = 'join' | 'leave' | 'commit'

export interface ChatMessage {
  id: string                // Firestore document ID
  userId: string
  username: string
  avatar: string
  message: string
  type: MessageType         // "system" = join/leave/commit events
  systemEvent?: SystemEventType  // Only set when type === 'system'
  timestamp: Timestamp
}

// ── Input for sending a new message ──
export type SendMessageInput = Omit<ChatMessage, 'id' | 'timestamp'>
```

### 14.4 `types/editor.ts`

```ts
export interface EditorTab {
  path: string              // File path, e.g. "src/app.ts"
  language: string
  content: string           // Current file content in the editor
  isActive: boolean
  isDirty: boolean          // Has unsaved changes vs. last GitHub version
  originalSha: string       // GitHub blob SHA when file was loaded
}

export interface CursorPosition {
  line: number
  column: number
}

export interface RemoteCursor {
  userId: string
  username: string
  color: string
  file: string
  position: CursorPosition
}

// ── Monaco editor settings (shared across all users) ──
export interface EditorSettings {
  fontSize: number          // Default: 14
  tabSize: number           // Default: 2
  wordWrap: 'on' | 'off'   // Default: 'on'
  minimap: boolean          // Default: false
  theme: 'vs-dark' | 'vs-light'  // Default: 'vs-dark'
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  minimap: false,
  theme: 'vs-dark',
}
```

### 14.5 `types/github.ts`

```ts
export interface GitHubRepo {
  id: number
  name: string
  full_name: string         // "owner/repo"
  description: string | null
  html_url: string
  language: string | null
  private: boolean
  default_branch: string
  stargazers_count: number
  fork: boolean
  updated_at: string
  owner: {
    login: string
    avatar_url: string
  }
}

// ── File to commit (local, before sending to API) ──
export interface CommitFile {
  path: string
  content: string           // Raw string content
}

// ── Full commit payload sent to /api/commits ──
export interface CommitPayload {
  sessionId: string
  files: CommitFile[]
  userMessage: string
  committerId: string
  repoOwner: string
  repoName: string
}

// ── File fetched from GitHub (includes SHA and Base64 encoding) ──
export interface GitHubFileContent {
  path: string
  content: string           // Base64 encoded
  sha: string               // Current blob SHA (needed for updates)
  encoding: 'base64'
  size: number
}

// ── Branch info ──
export interface GitHubBranch {
  name: string
  protected: boolean
  commit: {
    sha: string
  }
}
```

### 14.6 `types/presence.ts`

```ts
import type { Timestamp } from 'firebase/firestore'
import type { CursorColor } from './session'

export interface PresenceDoc {
  online: boolean
  username: string
  avatar: string
  color: CursorColor
  cursorFile: string
  cursorLine: number
  cursorColumn: number
  lastSeen: Timestamp
}

// ── App-level presence (with user ID from document path) ──
export interface Presence extends PresenceDoc {
  userId: string            // From Firestore document ID
}

// ── Connection status for WebRTC ──
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'relayed'
```

### 14.7 `types/api.ts`

```ts
// ── Standard API response wrapper ──
// ALL API routes MUST use this format. No exceptions.
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: ErrorCode            // Machine-readable error code
  message: string            // Human-readable message for the user
}

// ── All possible error codes (use as reference) ──
export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SESSION_FULL'
  | 'SESSION_CLOSED'
  | 'GITHUB_ERROR'
  | 'COMMIT_FAILED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
```

### 14.8 `types/draft.ts`

```ts
// ── Draft metadata stored in Firebase Storage ──
// Path: /drafts/{sessionId}/_meta.json
export interface DraftMeta {
  lastSavedAt: number       // Unix timestamp (ms)
  savedBy: string           // userId who triggered the save
  fileCount: number
  files: string[]           // List of file paths, e.g. ["src/index.ts"]
}
```

### 14.9 `types/toast.ts`

```ts
// ── Toast notification types ──
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
}
```

### 14.10 `types/index.ts` — Barrel Export

```ts
// Re-export everything for convenient imports
// Usage: import { User, Session, ChatMessage } from '@/types'

export * from './user'
export * from './session'
export * from './chat'
export * from './editor'
export * from './github'
export * from './presence'
export * from './api'
export * from './draft'
export * from './toast'
```

### 14.11 Usage Guidelines

```
Rule 1 — Always import from '@/types'
  ✅ import { User, Session } from '@/types'
  ✅ import type { ChatMessage } from '@/types/chat'
  ❌ interface User { ... }  // Never define shared types inline

Rule 2 — Use 'Doc' suffix for raw Firestore shapes
  ✅ UserDoc     → raw Firestore data (has Timestamp)
  ✅ User        → app-level data (has Date, includes uid)
  ✅ SessionDoc  → raw Firestore data
  ✅ Session     → SessionDoc + { id: string }

Rule 3 — Use input types for create operations
  ✅ CreateUserInput    → Omit<UserDoc, 'createdAt' | 'updatedAt'>
  ✅ CreateSessionInput → Pick<SessionDoc, ...> with optional defaults
  ✅ SendMessageInput   → Omit<ChatMessage, 'id' | 'timestamp'>

Rule 4 — Only ADD to types/ files, never remove
  Adding a new field to an interface → OK
  Removing a field → DISCUSS with team first
  Renaming a field → DISCUSS with team first
```

---

## 15. Standardized API Response Format

> **Rule:** Every API route MUST return the same response shape. No exceptions.

### 15.1 Success Response

```ts
// ✅ All success responses
return Response.json({
  success: true,
  data: { /* payload */ }
}, { status: 200 })
```

### 15.2 Error Response

```ts
// ❌ All error responses
return Response.json({
  success: false,
  error: {
    code: 'SESSION_FULL',
    message: 'This session has reached the maximum number of participants.'
  }
}, { status: 400 })
```

### 15.3 Standard Error Codes

| Code | HTTP Status | When to use |
|---|---|---|
| `AUTH_REQUIRED` | 401 | No auth token provided |
| `AUTH_EXPIRED` | 401 | Token expired, user must re-login |
| `FORBIDDEN` | 403 | User doesn't have permission |
| `NOT_FOUND` | 404 | Session/user/repo not found |
| `SESSION_FULL` | 400 | Session reached `maxParticipants` |
| `SESSION_CLOSED` | 400 | Session is no longer active |
| `GITHUB_ERROR` | 502 | GitHub API call failed |
| `COMMIT_FAILED` | 500 | File commit/push failed |
| `VALIDATION_ERROR` | 400 | Missing or invalid request body fields |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### 15.4 API Response Helper (Dev 4 creates this)

```ts
// lib/api/response.ts

import { type ApiResponse } from '@/types/api'
import { type NextResponse } from 'next/server'

export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } satisfies ApiResponse<T>, { status })
}

export function apiError(
  code: string,
  message: string,
  status = 400
): Response {
  return Response.json(
    { success: false, error: { code, message } } satisfies ApiResponse,
    { status }
  )
}
```

### 15.5 Usage Example

```ts
// app/api/sessions/route.ts
import { apiSuccess, apiError } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  const { repoName } = await req.json()

  if (!repoName) {
    return apiError('VALIDATION_ERROR', 'Repository name is required.', 400)
  }

  try {
    const session = await createSession(repoName)
    return apiSuccess(session, 201)
  } catch (err) {
    return apiError('INTERNAL_ERROR', 'Failed to create session.', 500)
  }
}
```

---

## 16. Error Handling Strategy

### 16.1 Three Layers of Error Handling

```
Layer 1 — API Routes (server-side)
  → Try/catch around all GitHub + Firestore calls
  → Always return standardized ApiResponse
  → Log errors server-side for debugging

Layer 2 — React Error Boundary (client-side)
  → Catches render crashes
  → Shows fallback UI instead of white screen
  → Reports error for debugging

Layer 3 — Toast Notifications (client-side)
  → Shows user-friendly messages for recoverable errors
  → Auto-dismiss after 5 seconds
  → Color-coded: red = error, yellow = warning, green = success
```

### 16.2 Error Boundary Component (Dev 1 creates)

```tsx
// components/ui/ErrorBoundary.tsx
'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Something went wrong
          </h2>
          <p className="text-[var(--text-secondary)]">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-md"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

### 16.3 Toast System using Zustand (Dev 1 creates)

```ts
// store/toastStore.ts
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastStore {
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (type, message) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }]
    }))
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }))
    }, 5000)
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  },
}))
```

### 16.4 Client-Side API Call Pattern

> **Rule:** Every `fetch()` call on the client must use this pattern. Never call `fetch()` directly without error handling.

```ts
// lib/api/client.ts
import { type ApiResponse } from '@/types/api'
import { useToastStore } from '@/store/toastStore'

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })

    const json: ApiResponse<T> = await res.json()

    if (!json.success) {
      // Show error toast
      useToastStore.getState().addToast('error', json.error?.message ?? 'Something went wrong')

      // Handle auth expiry globally
      if (json.error?.code === 'AUTH_EXPIRED') {
        window.location.href = '/login'
      }

      return null
    }

    return json.data ?? null

  } catch (err) {
    useToastStore.getState().addToast('error', 'Network error. Please check your connection.')
    return null
  }
}
```

### 16.5 Usage Example

```ts
// Inside any component or hook
const repos = await apiFetch<GitHubRepo[]>('/api/repos')

if (repos) {
  // ✅ Success — use data
  setRepos(repos)
}
// ❌ Error already handled by apiFetch (toast shown automatically)
```

---

## 17. Route Protection — `middleware.ts`

### 17.1 Implementation (Dev 1 owns)

```ts
// middleware.ts (project root)
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/session']

// Routes that should redirect to dashboard if ALREADY authenticated
const AUTH_ROUTES = ['/login']

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session')?.value

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  )
  const isAuthRoute = AUTH_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  // ── Not logged in + trying to access protected route → redirect to login
  if (isProtectedRoute && !sessionToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)   // Remember where they wanted to go
    return NextResponse.redirect(loginUrl)
  }

  // ── Already logged in + visiting login page → redirect to dashboard
  if (isAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/session/:path*', '/login'],
}
```

### 17.2 How It Works

```
User visits /session/abc123
        ↓
middleware.ts runs BEFORE the page loads
        ↓
Checks: does the user have a session cookie?
        ↓
NO  → Redirect to /login?redirect=/session/abc123
YES → Allow page to render normally
        ↓
After login, redirect back to /session/abc123 ✅
```

### 17.3 Session Cookie Setup (in OAuth callback)

```ts
// app/api/auth/github/callback/route.ts
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  // ... after successful GitHub OAuth exchange ...

  // Create Firebase custom token
  const customToken = await adminAuth.createCustomToken(userId)

  // Set session cookie (HTTP-only, secure, 7-day expiry)
  const cookieStore = await cookies()
  cookieStore.set('session', customToken, {
    httpOnly: true,          // Not accessible via JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,  // 7 days
    path: '/',
  })

  // Redirect to dashboard (or original destination)
  const redirect = req.nextUrl.searchParams.get('redirect') ?? '/dashboard'
  return NextResponse.redirect(new URL(redirect, req.url))
}
```

### 17.4 Two-Layer Protection Summary

```
Layer 1 — middleware.ts (Server-side)
  ✅ Runs before page loads
  ✅ Blocks access at network level
  ✅ Handles redirects with return URL
  ✅ Zero client-side flash

Layer 2 — AuthGuard (Client-side backup)
  ✅ Wraps protected page components
  ✅ Checks Firebase auth state
  ✅ Shows loading spinner while checking
  ✅ Catches edge cases middleware might miss
```

---

## 18. Session Cleanup & Disconnect Handling

### 18.1 The Problem

```
What happens when:
  → A user closes the browser tab mid-session?
  → A user's internet drops?
  → The session owner leaves without closing the session?
  → A session is created but never used?
  → All participants leave but the session stays "active: true"?
```

### 18.2 Disconnect Detection (Dev 3 owns)

Use Firebase's `onDisconnect()` to automatically clean up presence when a user goes offline.

```ts
// lib/firebase/presence.ts
import { db } from '@/lib/firebase/config'
import {
  doc, updateDoc, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import {
  getDatabase, ref, onDisconnect, set, onValue
} from 'firebase/database'

export function setupPresenceTracking(
  sessionId: string,
  userId: string
): () => void {
  // ── Firestore presence doc ──
  const presenceRef = doc(db, 'presence', sessionId, userId)

  // ── Firebase Realtime DB for disconnect detection ──
  // Firestore doesn't support onDisconnect, so we use RTDB
  const rtdb = getDatabase()
  const userStatusRef = ref(rtdb, `/status/${sessionId}/${userId}`)
  const connectedRef = ref(rtdb, '.info/connected')

  const unsubscribe = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() === false) return

    // When user disconnects, RTDB will automatically set this
    await onDisconnect(userStatusRef).set({
      online: false,
      lastSeen: Date.now(),
    })

    // User is currently online
    await set(userStatusRef, {
      online: true,
      lastSeen: Date.now(),
    })

    // Also update Firestore presence
    await updateDoc(presenceRef, {
      online: true,
      lastSeen: serverTimestamp(),
    })
  })

  return unsubscribe
}
```

### 18.3 Graceful Leave (when user clicks "Leave Session")

```ts
// lib/firebase/presence.ts
export async function leaveSession(
  sessionId: string,
  userId: string,
  username: string
): Promise<void> {
  // 1. Set presence to offline
  const presenceRef = doc(db, 'presence', sessionId, userId)
  await updateDoc(presenceRef, {
    online: false,
    lastSeen: serverTimestamp(),
  })

  // 2. Remove from session participants
  const sessionRef = doc(db, 'sessions', sessionId)
  await updateDoc(sessionRef, {
    [`participants.${userId}`]: deleteField(),
  })

  // 3. Add system message to chat
  await addDoc(collection(db, 'sessions', sessionId, 'chat'), {
    userId,
    username,
    avatar: '',
    message: `${username} left the session`,
    type: 'system',
    timestamp: serverTimestamp(),
  })
}
```

### 18.4 Abandoned Session Cleanup

Sessions that go inactive need automatic cleanup. There are two strategies:

#### Strategy A — Cloud Function (Recommended)

```ts
// Firebase Cloud Function — runs on a schedule
// functions/src/cleanup.ts

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const db = admin.firestore()

// Run every hour
export const cleanupAbandonedSessions = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now()
    const cutoff = new Date(now.toDate().getTime() - 24 * 60 * 60 * 1000)  // 24 hours ago

    // Find sessions that are active but haven't been updated in 24 hours
    const staleSessionsSnap = await db
      .collection('sessions')
      .where('active', '==', true)
      .where('lastDraftAt', '<', cutoff)
      .get()

    const batch = db.batch()

    staleSessionsSnap.forEach((doc) => {
      batch.update(doc.ref, {
        active: false,
        closedAt: now,
      })
    })

    await batch.commit()
    console.log(`Cleaned up ${staleSessionsSnap.size} abandoned sessions`)
  })
```

#### Strategy B — Client-Side Check (Fallback)

```ts
// When loading a session, check if it's stale
export async function isSessionStale(sessionId: string): Promise<boolean> {
  const sessionRef = doc(db, 'sessions', sessionId)
  const snap = await getDoc(sessionRef)

  if (!snap.exists()) return true

  const data = snap.data()
  if (!data.active) return true

  // Check if no presence activity for 2 hours
  const presenceSnap = await getDocs(
    collection(db, 'presence', sessionId)
  )

  const anyoneOnline = presenceSnap.docs.some(
    (doc) => doc.data().online === true
  )

  if (!anyoneOnline) {
    const lastDraft = data.lastDraftAt?.toDate()
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    if (!lastDraft || lastDraft < twoHoursAgo) {
      // Auto-close the stale session
      await updateDoc(sessionRef, {
        active: false,
        closedAt: serverTimestamp(),
      })
      return true
    }
  }

  return false
}
```

### 18.5 Cleanup Summary

```
┌─────────────────────────────────────────────────────────┐
│                    SESSION CLEANUP                       │
│                                                         │
│  Trigger              Action                            │
│  ─────────────────    ─────────────────────────────      │
│  Tab closed           → onDisconnect sets offline        │
│  Internet drops       → onDisconnect sets offline        │
│  "Leave" clicked      → Remove from participants         │
│                       → Set presence offline             │
│                       → Add system chat message          │
│  Owner closes session → active: false, closedAt: now     │
│  24h no activity      → Cloud Function auto-closes       │
│  All users leave      → Client check marks stale         │
│  Session opened but   → Stale check on load              │
│  everyone left        → Auto-close if 2h inactive        │
└─────────────────────────────────────────────────────────┘
```

---

## 19. WebRTC Fallback — TURN Server

### 19.1 The Problem

```
WebRTC uses P2P (peer-to-peer) connections.
This works great on most networks, BUT:

  ❌ Corporate firewalls block P2P
  ❌ Symmetric NATs prevent direct connections
  ❌ Some university WiFi networks block WebRTC
  ❌ ~10-15% of users will fail to connect without a TURN server

STUN servers (free) handle simple NAT traversal.
TURN servers (paid) relay traffic when P2P fails — they are the FALLBACK.
```

### 19.2 ICE Server Configuration

```ts
// lib/yjs/provider.ts
import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

// ICE servers for WebRTC connection
const ICE_SERVERS: RTCIceServer[] = [
  // ── Free STUN servers (NAT traversal) ──
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },

  // ── TURN server (relay fallback) ──
  // ⚠️ Replace with actual credentials from your TURN provider
  {
    urls: 'turn:your-turn-server.com:3478',
    username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? '',
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? '',
  },
  {
    urls: 'turns:your-turn-server.com:5349',  // TLS variant
    username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? '',
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? '',
  },
]

export function createCollabProvider(
  sessionId: string,
  ydoc: Y.Doc
): WebrtcProvider {
  const provider = new WebrtcProvider(
    `codesync-${sessionId}`,       // Room name
    ydoc,
    {
      signaling: ['wss://signaling.yjs.dev'],   // Default Yjs signaling
      password: sessionId,                       // Room password
      awareness: ydoc.awareness,
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
```

### 19.3 TURN Server Options

| Provider | Free Tier | Paid | Best For |
|---|---|---|---|
| **Metered.ca** | 500 MB/month free | $0.40/GB | MVP / student projects ✅ |
| **Twilio TURN** | First 500 connections free | $0.40/GB | Production apps |
| **Xirsys** | 500 MB/month free | Pay-as-you-go | Global coverage |
| **Self-hosted Coturn** | Free (you host) | Server cost only | Full control, cheapest at scale |

> **Recommendation for CodeSync:** Start with **Metered.ca** free tier (500 MB/month is enough for a student project). Upgrade to Twilio/Coturn if the project scales.

### 19.4 Environment Variables for TURN

```env
# .env.example — add these
NEXT_PUBLIC_TURN_URL=turn:relay.metered.ca:3478
NEXT_PUBLIC_TURN_USERNAME=
NEXT_PUBLIC_TURN_CREDENTIAL=
```

### 19.5 Connection Flow with Fallback

```
Peer A wants to connect to Peer B
        ↓
Step 1 — Try direct P2P connection
         (STUN resolves public IP)
        ↓
    ┌─── SUCCESS? ───┐
    │                 │
   YES               NO (firewall/NAT blocks it)
    │                 │
    ↓                 ↓
 P2P active      Step 2 — Try TURN relay
 (~10-50ms)              ↓
                   TURN server relays traffic
                   between Peer A and Peer B
                   (~50-150ms, slightly slower)
                         ↓
                   Connection established ✅
                      
All of this happens automatically via ICE negotiation.
No code changes needed — just configure the ICE servers.
```

### 19.6 Monitoring Connection Quality

```ts
// hooks/useConnectionStatus.ts
import { useState, useEffect } from 'react'
import type { WebrtcProvider } from 'y-webrtc'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'relayed'

export function useConnectionStatus(provider: WebrtcProvider | null): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    if (!provider) return

    const handleStatus = ({ connected }: { connected: boolean }) => {
      setStatus(connected ? 'connected' : 'disconnected')
    }

    provider.on('status', handleStatus)

    // Check if connection is relayed (TURN) or direct (STUN)
    provider.on('peers', ({ added }: { added: string[] }) => {
      if (added.length > 0) {
        // Connection established
        setStatus('connected')
      }
    })

    return () => {
      provider.off('status', handleStatus)
    }
  }, [provider])

  return status
}
```

---

## 20. Performance Optimizations

### 20.1 Monaco Editor — Lazy Loading

Monaco Editor is the largest dependency (~5 MB). It MUST be lazy-loaded to avoid blocking the initial page load.

```tsx
// components/editor/CodeEditor.tsx
'use client'

import dynamic from 'next/dynamic'
import { Loader } from '@/components/ui/Loader'

// ⚡ Lazy load Monaco — only downloaded when editor page is visited
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  {
    ssr: false,                        // Monaco doesn't work on server
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[var(--editor-bg)]">
        <Loader text="Loading editor..." />
      </div>
    ),
  }
)

interface CodeEditorProps {
  value: string
  language: string
  onChange: (value: string | undefined) => void
  readOnly?: boolean
}

export function CodeEditor({ value, language, onChange, readOnly }: CodeEditorProps) {
  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={value}
      onChange={onChange}
      theme="vs-dark"
      options={{
        readOnly,
        fontSize: 14,
        fontFamily: 'var(--font-mono)',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
        cursorBlinking: 'smooth',
        smoothScrolling: true,
        padding: { top: 16 },
      }}
    />
  )
}
```

### 20.2 Route-Level Code Splitting

Next.js App Router does this automatically, but we enforce it by keeping heavy imports inside page components, not in shared code.

```
Bundle split targets:

  /login          → ~50 KB (tiny, loads fast)
  /dashboard      → ~120 KB (repo list, cards)
  /session/[id]   → ~5.5 MB (Monaco + Yjs + WebRTC)
                    ↑ This is lazy-loaded, so login/dashboard stay fast

Rules:
  ✅ Monaco imported ONLY inside components/editor/CodeEditor.tsx
  ✅ Yjs imported ONLY inside lib/yjs/
  ✅ y-webrtc imported ONLY inside lib/yjs/provider.ts
  ❌ NEVER import Monaco or Yjs in layout.tsx, page.tsx (outside session), or any shared component
```

### 20.3 Firestore Query Limits & Optimization

```
Rule 1 — Always limit queries
  ❌ getDocs(collection(db, 'sessions'))              // Fetches ALL sessions
  ✅ getDocs(query(collection(db, 'sessions'),         // Fetches only 20
       where('active', '==', true),
       orderBy('createdAt', 'desc'),
       limit(20)
     ))

Rule 2 — Use real-time listeners only where needed
  ✅ Real-time:  presence, chat, session participants   // Changes every second
  ❌ Real-time:  user profile, repo list                // Changes rarely
  ✅ One-time:   user profile (getDoc), repo list       // Fetch once, cache

Rule 3 — Batch writes when possible
  ❌ 10 separate updateDoc() calls                     // 10 writes
  ✅ writeBatch() with all 10 in one batch             // 1 write operation

Rule 4 — Use projection masks for large documents
  ✅ getDoc(ref, { fieldMask: ['username', 'avatar'] }) // Only fetch what you need
```

### 20.4 Image & Asset Optimization

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Allow GitHub avatar URLs
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['@monaco-editor/react', 'firebase'],
  },
}

export default nextConfig
```

### 20.5 Firestore Reads Budget

> **Important:** Firestore free tier = 50,000 reads/day. Here's how to stay within budget:

| Operation | Reads Per Action | Frequency | Daily Estimate |
|---|---|---|---|
| Load session | 1 | Per user per session | ~50 |
| Chat listener | 1 per new message | Real-time | ~500 |
| Presence listener | 1 per update | Every 30 seconds/user | ~2,000 |
| File editors (commit time) | 1 per file | Per commit | ~20 |
| User profile | 1 | Per login | ~10 |
| Repo list | 0 (GitHub API) | — | 0 |

**Total estimated:** ~2,500 reads/day for 4 active users = well within free tier.

### 20.6 Performance Checklist

```
- [ ] Monaco dynamically imported with next/dynamic + ssr: false
- [ ] Yjs + y-webrtc only imported inside session pages
- [ ] All Firestore queries have limit() applied
- [ ] Presence updates throttled to max once per 30 seconds
- [ ] Chat listener uses orderBy + limitToLast(50) on initial load
- [ ] GitHub avatars loaded via next/image with width/height set
- [ ] optimizePackageImports enabled for Monaco + Firebase
- [ ] No console.log() left in production (use conditional logging)
```

---

## 21. Merge Conflict Prevention

> **The #1 reason student teams fail is merge conflicts that spiral out of control.** This section exists to prevent that. Follow every rule here.

### 21.1 Conflict Hotspot Analysis

These are the files where merge conflicts WILL happen if not managed:

```
🔴 HIGH RISK — Multiple devs will need to touch these:
   app/layout.tsx           ← Every dev needs to add providers/wrappers
   package.json             ← Every dev needs new dependencies
   types/index.ts           ← Every dev needs to export their types
   .env.example             ← Every dev might add new env vars
   globals.css              ← Multiple devs may add new CSS variables

🟡 MEDIUM RISK — Occasionally shared:
   components/ui/*          ← Any dev might need a new shared component
   tailwind.config.ts       ← Rarely changes, but possible
   next.config.ts           ← Rarely changes

🟢 LOW RISK — Each dev owns their own:
   components/auth/*        ← Only Dev 1
   components/dashboard/*   ← Only Dev 2
   components/editor/*      ← Only Dev 3
   components/chat/*        ← Only Dev 4
   All hooks, stores, lib/* ← Clear ownership
```

### 21.2 Solution: The Providers Pattern

The biggest conflict source is `layout.tsx`. Every dev needs to wrap the app with their provider (Auth, Session, Toast, etc.). 

**Fix:** Create a `Providers` component so `layout.tsx` is touched ONCE and never again.

```tsx
// components/providers/AppProviders.tsx — Dev 1 creates, then each dev adds their own

'use client'

import { type ReactNode } from 'react'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
// ↑ Each dev adds their import here (one line each = easy merge)

interface Props {
  children: ReactNode
}

export function AppProviders({ children }: Props) {
  return (
    <AuthProvider>        {/* Dev 1 adds */}
      <ToastProvider>     {/* Dev 1 adds */}
        {children}
      </ToastProvider>
    </AuthProvider>
  )
}
```

```tsx
// app/layout.tsx — Dev 1 sets up ONCE, never needs editing again

import { AppProviders } from '@/components/providers/AppProviders'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import './globals.css'

export const metadata = {
  title: 'CodeSync',
  description: 'Collaborative coding platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <AppProviders>
            {children}
          </AppProviders>
        </ErrorBoundary>
      </body>
    </html>
  )
}
// ✅ This file is DONE. No dev ever needs to edit it again.
```

**Each dev creates their own provider file:**

```
components/providers/
  ├── AppProviders.tsx        ← Wraps all providers (merge point, but simple)
  ├── AuthProvider.tsx        ← Dev 1 creates & owns
  └── ToastProvider.tsx       ← Dev 1 creates & owns
```

> When a dev needs a new provider (e.g. Dev 2 needs a `SessionProvider`), they:
> 1. Create `components/providers/SessionProvider.tsx` (their own file, no conflict)
> 2. Add ONE import line + ONE wrapper line in `AppProviders.tsx` (tiny change, easy merge)

### 21.3 Solution: Shared File Protocols

#### `package.json` — Dependency Installs

```
RULE: Only Dev 1 runs `npm install`

Process:
  1. Dev 2 needs `zustand` → Messages group chat: "Need zustand"
  2. Dev 1 runs: npm install zustand
  3. Dev 1 commits package.json + package-lock.json
  4. Dev 1 pushes to develop
  5. Everyone pulls develop into their branch
  6. Everyone runs: npm install (to sync lock file)

WHY: package-lock.json is 5000+ lines. If two devs install packages
on different branches, the merge conflict is UNFIXABLE.
```

#### `globals.css` — Theme Variables

```
RULE: Use commented sections. Each dev adds ONLY at the end of their section.

/* ═══ BASE THEME — Dev 1 owns ═══ */
--color-primary: #2563eb;
...

/* ═══ EDITOR THEME — Dev 3 owns ═══ */
--editor-cursor-width: 2px;
...

/* ═══ CHAT THEME — Dev 4 owns ═══ */
--chat-bubble-bg: #1e293b;
...

WHY: If devs add variables in the middle of the file, lines shift
and Git can't auto-merge. Adding at the end of owned sections avoids this.
```

#### `types/` — Shared TypeScript Types

```
RULE: Each dev owns their own type files. Only ADD to the barrel export.

types/
  ├── user.ts       ← Dev 1 owns
  ├── session.ts    ← Dev 2 owns
  ├── editor.ts     ← Dev 3 owns
  ├── chat.ts       ← Dev 4 owns
  ├── github.ts     ← Dev 4 owns
  ├── presence.ts   ← Dev 3 owns
  ├── api.ts        ← Dev 4 owns
  ├── draft.ts      ← Dev 3 owns
  ├── toast.ts      ← Dev 1 owns
  └── index.ts      ← Barrel (append-only)

PROCESS for adding a new type:
  1. Create your own new file: types/webhook.ts (no conflict)
  2. Add ONE line to index.ts: export * from './webhook'
     (append at end = minimal conflict risk)

NEVER modify another dev's type file without asking.
```

#### `components/ui/` — Shared UI Components

```
RULE: Create new UI components freely. Editing existing ones = ask first.

SAFE (no conflict):
  ✅ Creating components/ui/Tooltip.tsx     ← New file = no conflict
  ✅ Creating components/ui/Dropdown.tsx    ← New file = no conflict

DANGEROUS (discuss first):
  ⚠️ Editing components/ui/Button.tsx       ← Other devs may be using it
  ⚠️ Adding new props to Modal.tsx          ← Might break other usages

PROCESS for editing shared UI:
  1. Message group chat: "I need to add `size` prop to Button.tsx"
  2. Wait for acknowledgment
  3. Make change on a SEPARATE commit (not mixed with feature work)
  4. Push immediately so others can pull
```

#### `.env.example` — Environment Variables

```
RULE: Use commented sections, same as globals.css.

# ═══ Firebase (Dev 1 manages) ═══
NEXT_PUBLIC_FIREBASE_API_KEY=
...

# ═══ GitHub OAuth (Dev 4 manages) ═══
GITHUB_CLIENT_ID=
...

# ═══ WebRTC / TURN (Dev 3 manages) ═══
NEXT_PUBLIC_TURN_URL=
...

PROCESS: Add your variables at the end of YOUR section only.
```

### 21.4 Integration Contracts

When two devs need to connect their work, define the **contract** (interface) FIRST, then build independently.

```
┌──────────────────────────────────────────────────────────────┐
│              INTEGRATION POINTS & CONTRACTS                  │
│                                                              │
│  Connection              Contract Owner    Agreed Interface  │
│  ──────────────────────  ──────────────    ────────────────  │
│                                                              │
│  Auth → Dashboard        Dev 1 exports     useAuth() hook    │
│    Dev 2 needs user      → { user, loading, login, logout }  │
│    data on dashboard     Dev 2 imports & uses it             │
│                                                              │
│  Dashboard → Session     Dev 2 exports     createSession()   │
│    clicking a repo       → returns sessionId                 │
│    creates a session     Dev 3 reads session from Firestore  │
│                                                              │
│  Session → Editor        Dev 3 owns both   Internal wiring   │
│    session page loads    No contract needed (same dev)        │
│    the editor                                                │
│                                                              │
│  Editor → Chat           Dev 3 exports     editorStore       │
│    chat shows which      → { activeFile, participants }      │
│    file each user is on  Dev 4 reads from store              │
│                                                              │
│  Auth → API Routes       Dev 1 exports     session cookie    │
│    API routes need to    → cookie name: 'session'            │
│    verify user identity  Dev 4 reads cookie in API routes    │
│                                                              │
│  API Routes → GitHub     Dev 4 owns both   Internal wiring   │
│    API routes call       No contract needed (same dev)        │
│    GitHub API                                                │
│                                                              │
│  Editor → Commit         Dev 3 provides    editorStore       │
│    commit button reads   → { files, dirtyFiles }             │
│    current file state    Dev 4 reads from store for commit   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 21.5 Contract-First Development Pattern

Before building a feature that crosses dev boundaries, agree on the interface:

```ts
// STEP 1: Dev 1 creates the hook signature (even if empty)
// hooks/useAuth.ts

export function useAuth() {
  // TODO: implement
  return {
    user: null as User | null,
    loading: true,
    isAuthenticated: false,
    login: async () => {},
    logout: async () => {},
  }
}

// STEP 2: Dev 2 can now build the dashboard using this hook
// Dev 2 doesn't need to wait for Dev 1 to finish auth
// The dashboard works with loading: true until auth is ready

// STEP 3: Dev 1 implements the real logic later
// Dev 2's code doesn't need to change because the interface is the same
```

### 21.6 Day-1 Setup Order (Prevents Early Conflicts)

```
HOUR 1 — Dev 1 alone (everyone else waits)
  ✅ npx create-next-app@latest ./ --typescript --tailwind --eslint --app
  ✅ Set up folder structure (all empty folders with .gitkeep)
  ✅ Set up globals.css with theme variables
  ✅ Set up layout.tsx with AppProviders
  ✅ Set up middleware.ts (skeleton)
  ✅ Create all type files (empty exports)
  ✅ Create .env.example with sections
  ✅ Create .gitignore
  ✅ Commit all → push to main
  ✅ Create develop branch from main → push

HOUR 2 — Everyone starts
  ✅ Dev 1: git checkout -b feature/dev1-auth develop
  ✅ Dev 2: git checkout -b feature/dev2-dashboard develop
  ✅ Dev 3: git checkout -b feature/dev3-editor develop
  ✅ Dev 4: git checkout -b feature/dev4-api develop

  Each dev now works in their own files. ZERO overlap.

HOUR 3+ — Independent work
  Each dev builds in their own folders.
  Dependency requests go through group chat → Dev 1 installs.
  Type changes go through owned type files.
  Shared UI components are created as NEW files (no editing existing ones).
```

### 21.7 Conflict Resolution Protocol

```
When a conflict DOES happen (inevitable):

Step 1 — STOP. Don't try to resolve blindly.
Step 2 — Message the other dev: "I have a conflict in [filename]"
Step 3 — Get on a call / screen share
Step 4 — The dev who OWNS the file resolves the conflict
Step 5 — Both devs verify the resolved file works
Step 6 — Commit the resolution with message: "fix: resolve merge conflict in [file]"

NEVER:
  ❌ Accept "mine" or "theirs" without understanding both changes
  ❌ Resolve conflicts in files you don't own
  ❌ Commit a conflict resolution without testing
```

### 21.8 Updated Folder Structure (with conflict-safe additions)

```
codesync/
│
├── components/
│   ├── providers/                    # ── CONFLICT-SAFE PATTERN ──
│   │   ├── AppProviders.tsx          # Dev 1 creates; minimal merge point
│   │   ├── AuthProvider.tsx          # Dev 1 owns
│   │   └── ToastProvider.tsx         # Dev 1 owns
│   │   (other devs add their own provider files here — no conflict)
│   │
│   ├── auth/                         # ── DEV 1 only ──
│   ├── dashboard/                    # ── DEV 2 only ──
│   ├── session/                      # ── DEV 3 only ──
│   ├── editor/                       # ── DEV 3 only ──
│   ├── chat/                         # ── DEV 4 only ──
│   └── ui/                           # ── NEW files ok, EDITING needs discussion ──
│
├── types/                            # ── Each dev owns specific files ──
│   ├── user.ts                       # Dev 1
│   ├── session.ts                    # Dev 2
│   ├── editor.ts                     # Dev 3
│   ├── chat.ts                       # Dev 4
│   ├── github.ts                     # Dev 4
│   ├── presence.ts                   # Dev 3
│   ├── api.ts                        # Dev 4
│   ├── draft.ts                      # Dev 3
│   ├── toast.ts                      # Dev 1
│   └── index.ts                      # Barrel (append-only, one line per file)
│
├── hooks/                            # ── Each dev owns their hooks ──
│   ├── useAuth.ts                    # Dev 1 — exports contract for Dev 2
│   ├── useRepos.ts                   # Dev 2
│   ├── useSession.ts                 # Dev 2
│   ├── useEditor.ts                  # Dev 3 — exports contract for Dev 4
│   ├── useCollaboration.ts           # Dev 3
│   ├── useFileEditorTracking.ts      # Dev 3
│   ├── useChat.ts                    # Dev 4
│   └── useConnectionStatus.ts        # Dev 3
│
└── store/                            # ── Each dev owns their store ──
    ├── authStore.ts                  # Dev 1 — exports contract for Dev 2, 4
    ├── repoStore.ts                  # Dev 2
    ├── sessionStore.ts               # Dev 2 — exports contract for Dev 3
    ├── editorStore.ts                # Dev 3 — exports contract for Dev 4
    └── toastStore.ts                 # Dev 1
```

### 21.9 Quick Reference Card

```
╔══════════════════════════════════════════════════════════════╗
║              MERGE CONFLICT CHEAT SHEET                      ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  DO:                                                         ║
║  ✅ Create new files instead of editing shared ones           ║
║  ✅ Add at the end of shared files (globals.css, .env)        ║
║  ✅ Agree on interfaces before building cross-dev features    ║
║  ✅ Pull develop into your branch every morning               ║
║  ✅ Make small, focused commits (not giant ones)              ║
║  ✅ Push your branch daily (even if not done)                 ║
║                                                              ║
║  DON'T:                                                      ║
║  ❌ Edit layout.tsx (use AppProviders instead)                ║
║  ❌ Run npm install yourself (ask Dev 1)                      ║
║  ❌ Modify another dev's type file without asking             ║
║  ❌ Edit existing shared UI components without group chat     ║
║  ❌ Work for 3 days without merging develop into your branch  ║
║  ❌ Commit package-lock.json changes alongside feature code   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```
