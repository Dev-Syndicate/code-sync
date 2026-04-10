# Plan: Draft save, autosave, co-authors, and commit revert

> Source PRD: [PRD-save-autosave-coauthors-revert.md](../PRD-save-autosave-coauthors-revert.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **New routes**:
  - `POST /api/sessions/[id]/drafts` — upload draft files (any participant)
  - `POST /api/sessions/[id]/mark-contributor` — idempotent contributor recording (any participant)
  - `GET  /api/repos/[owner]/[repo]/commits?branch=&limit=` — list recent branch commits
  - `POST /api/commits/revert` — owner-only safe revert
- **Extended routes**: `POST /api/commits` additionally deletes `drafts/{sessionId}/*` and clears `lastDraftAt` on success.
- **Firebase Storage layout**: `drafts/{sessionId}/{path}` with object metadata `{ originalSha, uploadedBy, uploadedAt }`. All writes go through Admin SDK on server routes — no client-side Storage rules changes.
- **Firestore schema changes** (on `sessions/{id}`):
  - `contributors: { [uid]: { firstEditAt: Timestamp } }` — new, edit-based (replaces the old `fileEditors` subcollection)
  - `commits: string[]` — new, appended with every successful commit sha, used to color own-vs-external commits in history
  - `lastDraftAt` — existing field, now actually written/cleared
- **Deep modules (simple interface, hidden complexity)**:
  - `DraftStore` — façade over Admin Storage: `saveDraft`, `loadDraft`, `deleteSessionDrafts`
  - `YDocDiffer` — pure function: `diffAgainstOriginal(ydoc, originals) → FileChange[]`
  - `AutosaveCoordinator` — leader election + debounce + ceiling
  - `CommitReverter` — Git Tree API juggling + upfront conflict detection
- **Persistence ownership**: live state in Yjs (RAM), crash recovery in Firebase Storage drafts, permanent in GitHub, metadata in Firestore. Drafts are crash-recovery-only (one per path, overwritten on save, not version history).
- **Admin SDK expansion**: `src/lib/firebase/admin.ts` gains an `adminStorage` export.
- **Authority for uid → name/email**: `ensureUserDoc` is the single source of truth, with Firebase Auth backfill for legacy accounts.
- **Restore priority on file open**: live Yjs content → matching draft (sha matches GitHub) → GitHub API fetch. Stale drafts are deleted + toasted.
- **Never rewrite history**: revert is always an additive new commit; no force-push, no reset.
- **No automated tests**: manual acceptance only. Each build phase is followed by a dedicated manual test phase.

---

## Phase 1: Manual draft save + restore

**User stories**: 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 33

### What to build

A Save button in the session header next to Commit & Push that snapshots every modified file in the session to Firebase Storage via an admin-only server route. The button is disabled when there are no unsaved changes, shows a "Saving…" state while in-flight, and surfaces a "Save failed" toast on error. A "Saved Ns ago" indicator appears in the status bar. On reopening a session, files are restored in priority order: live Yjs → draft (if its `originalSha` still matches GitHub) → GitHub. Stale drafts are discarded with a toast. A successful Commit & Push deletes the session's drafts and clears `lastDraftAt`. No autosave yet — saving is strictly manual.

### Acceptance criteria

- [ ] `adminStorage` is exported from the Firebase admin module and used exclusively by server routes
- [ ] `DraftStore` exposes `saveDraft`, `loadDraft`, `deleteSessionDrafts` with all bucket/metadata/retry concerns hidden inside
- [ ] `YDocDiffer` is a pure function that returns only files whose content differs from their original GitHub content
- [ ] `POST /api/sessions/[id]/drafts` accepts `{ files: [{ path, content, originalSha }] }`, writes via Admin Storage, and updates `lastDraftAt`
- [ ] Save button in the header between Share and Commit & Push; disabled when diff is empty
- [ ] Status bar shows "Saved Ns ago" / "Saving…" / "Save failed"
- [ ] Restore-on-open priority (Yjs → valid draft → GitHub) is implemented; stale drafts are deleted and a toast is shown
- [ ] `POST /api/commits` additionally deletes `drafts/{sessionId}/*` on successful push
- [ ] PR description documents the manual 7-day Storage TTL lifecycle rule setup

---

## Phase 2: Manual testing — draft save + restore

**User stories**: 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 33

### What to build

End-to-end manual verification of the Phase 1 slice. No code unless a bug is found (then fix and re-verify).

### Acceptance criteria

- [ ] Save button is disabled when the session has no unsaved changes; enables as soon as any participant types
- [ ] Clicking Save writes drafts for **every** modified file in the session (not just files the clicker has open)
- [ ] A non-owner participant can Save successfully
- [ ] Status bar transitions through "Saving…" → "Saved Ns ago" on success
- [ ] Forcing a server error produces a "Save failed" toast and the indicator reflects the failure
- [ ] Hard-kill the browser tab mid-session after a Save; reopening the session URL restores the edited content from the draft
- [ ] With two browsers in the same session, reopening one while the other still holds live Yjs state restores from Yjs (not stale draft)
- [ ] Manually bumping a file's GitHub sha (push from terminal) while a draft exists causes the next open to discard the draft with a toast and fall back to GitHub
- [ ] Commit & Push succeeds and verifiably deletes the `drafts/{sessionId}/*` objects in the Firebase console; `lastDraftAt` is cleared
- [ ] The 7-day TTL lifecycle rule is configured in the Firebase console per the PR doc

---

## Phase 3: Autosave with leader election

**User stories**: 2, 3, 4

### What to build

Every participant runs an `AutosaveCoordinator` that deterministically elects a leader as the Yjs client with the lowest `clientID` (read off awareness). Only the leader listens to `ydoc.on('update')`, debounces 2 seconds on each update, and forces a save at the 30-second ceiling for non-stop typists. Non-leaders do nothing until leadership changes. When the leader disconnects, the next-lowest clientID takes over on the next awareness tick. The coordinator reuses the Phase 1 endpoint and status-bar indicator — no new routes or UI.

### Acceptance criteria

- [ ] `AutosaveCoordinator` constructor takes `{ ydoc, awareness, myClientID, onSave, debounceMs, ceilingMs }` and returns a `dispose` from `start()`
- [ ] Leader computation is a pure comparison over awareness states — no coordination messages, no Firestore, no locks
- [ ] Only the leader's client fires `onSave`; non-leader clients observe updates but do nothing
- [ ] Debounce resets on every update; ceiling forces a save for continuous typists
- [ ] Leader handoff happens automatically when the current leader's awareness state disappears
- [ ] Mounted in the session page; no manual wiring required per file

---

## Phase 4: Manual testing — autosave

**User stories**: 2, 3, 4

### What to build

End-to-end manual verification of leader-elected autosave.

### Acceptance criteria

- [ ] With one browser, idle typing produces exactly one save ~2s after the last keystroke
- [ ] With two browsers, a single Save indicator updates (not duplicated); only one client's network tab shows the upload
- [ ] Continuous typing for 30+ seconds produces a ceiling-triggered save even without an idle pause
- [ ] Closing the current leader browser causes the other browser to take over autosave within one awareness tick — verified by watching its network tab
- [ ] A manual Save click still fires immediately and bypasses the debounce
- [ ] Status-bar "Saved Ns ago" updates on autosave without any user interaction
- [ ] Reopening a session after a crash restores content that was only ever autosaved (never manually saved)

---

## Phase 5: Edit-based co-author tracking

**User stories**: 16, 17, 18, 19

### What to build

Session docs gain a `contributors` map that is populated only when a client observes its **first local-origin Yjs update** (guarded by a `useRef` flag, one call per mount). The server records `contributors.{uid}.firstEditAt = serverTimestamp()` via a new `POST /api/sessions/[id]/mark-contributor` route. `buildCommitMessage` is rewritten to read from `session.contributors`, resolve each non-committer contributor's name/email via `ensureUserDoc` (with GitHub noreply email fallback), and append `Co-Authored-By:` trailers after a blank line. The old `fileEditors` subcollection and `useFileEditorTracking` hook are deleted outright — no migration, zero prod users.

### Acceptance criteria

- [ ] `POST /api/sessions/[id]/mark-contributor` is idempotent and writes `contributors.{uid}.firstEditAt` via dot-notation `update`
- [ ] Client fires the mark-contributor call exactly once per mount, only after observing a local-origin Yjs update
- [ ] Remote peer updates never trigger contributor marking
- [ ] `buildCommitMessage` signature and call site in `POST /api/commits` are unchanged
- [ ] `buildCommitMessage` reads from `session.contributors` and resolves name/email via `ensureUserDoc`
- [ ] Email falls back to `{login}@users.noreply.github.com` when the resolved email is empty
- [ ] Trailers format exactly as `Co-Authored-By: Name <email>`, one per line, after a blank line
- [ ] `fileEditors` subcollection references and `useFileEditorTracking` hook are removed from the codebase

---

## Phase 6: Manual testing — co-author trailers

**User stories**: 16, 17, 18, 19

### What to build

End-to-end manual verification of edit-based co-authorship.

### Acceptance criteria

- [ ] A user who joins a session and only watches (no typing) is **not** recorded in `contributors`
- [ ] A user who types in any file is recorded in `contributors` exactly once
- [ ] Typing in multiple files still produces a single `contributors` entry per uid
- [ ] Committing a session where two other users typed produces a commit body with exactly two `Co-Authored-By:` trailers — not including the committer
- [ ] The resulting commit on GitHub shows multiple avatars in the GitHub UI
- [ ] A contributor whose Firestore user doc has no email still gets a working `{login}@users.noreply.github.com` trailer
- [ ] No `fileEditors` subcollection is written anywhere during a session

---

## Phase 7: History modal + commit revert

**User stories**: 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32

### What to build

A History button in the session header between Save and Commit & Push opens a modal listing the last 30 commits on the current branch, fetched via `GET /api/repos/[owner]/[repo]/commits`. Each row shows sha, shortSha, first-line message, author name + avatar, and relative timestamp. Commits whose sha is in `session.commits` (tracked by `POST /api/commits`) render their Revert button in green ("your own"); others render yellow ("external"). For non-owners, Revert buttons are disabled with a tooltip. Clicking Revert opens a confirmation prompt naming the commit author, then calls `POST /api/commits/revert`. The server uses `CommitReverter` to fetch the commit + parent, compute the reverted tree, detect conflicts against the current HEAD **before any write**, and either return a structured `MERGE_CONFLICT` with conflicting paths or create a new reverting commit via the Git Tree API. On success, the session's Yjs state is reconciled: if live content matches pre-revert state, silently reset to the new HEAD; if it has diverged, prompt the owner to keep-or-discard the divergent edits. A system chat message announces every successful revert. Revert commits themselves appear in history and are revertable.

### Acceptance criteria

- [ ] `GET /api/repos/[owner]/[repo]/commits?branch=&limit=` returns a cleaned shape with `sha`, `shortSha`, `message`, `author { name, email, avatarUrl, login }`, `committedAt`, `url`
- [ ] `POST /api/commits` appends the new sha to `session.commits`
- [ ] History modal shows last 30 commits on the current branch, not just session commits
- [ ] Revert buttons color green for shas in `session.commits`, yellow otherwise
- [ ] Non-owner participants see the history but Revert buttons are disabled with an explanatory tooltip
- [ ] Confirmation prompt always shows the commit's author name
- [ ] `CommitReverter` detects conflicts by comparing the reverted tree against current HEAD **before any GitHub write**
- [ ] Conflict case returns a structured `MERGE_CONFLICT` error listing conflicting paths; no partial writes happen
- [ ] Clean case creates a new reverting commit via Git Tree API and pushes the ref — never force-pushes
- [ ] After a successful revert, Yjs content matching the pre-revert state is silently reset to the new HEAD
- [ ] After a successful revert, Yjs content that diverged prompts the owner to keep-or-discard
- [ ] A system chat message `"<username> reverted commit <shortSha> '<original message>'."` is posted on success
- [ ] Revert commits appear in the history list as normal entries and can themselves be reverted

---

## Phase 8: Manual testing — history + revert

**User stories**: 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32

### What to build

End-to-end manual verification of the history modal and revert flow.

### Acceptance criteria

- [ ] History modal opens showing the 30 most recent commits on the current branch
- [ ] Own-session commits are visually green; external commits (pushed from terminal) are yellow
- [ ] Non-owner sees the list but cannot click Revert; tooltip explains why
- [ ] Confirmation prompt names the correct author for a commit authored by someone else
- [ ] Reverting a clean commit creates a new reverting commit on GitHub — verified in GitHub UI; no force-push occurred
- [ ] Reverting a commit whose files have since changed on HEAD returns a conflict error listing the conflicting paths — no write lands on GitHub
- [ ] After reverting immediately (no further edits), the editor silently rewinds to the new HEAD for all session participants
- [ ] After reverting with divergent in-session edits, the owner is prompted to keep-or-discard; both branches of the prompt behave correctly
- [ ] A chat system message appears for every participant after a successful revert
- [ ] Reverting a revert commit works and produces a normal forward commit
- [ ] The History modal, when manually reopened, includes the new revert commits
