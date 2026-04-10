# PRD — Draft save, autosave, co-authors, and commit revert

## Problem Statement

From the user's perspective:

> "I'm editing code in a CodeSync session with a teammate. If my browser crashes, or the Yjs server restarts, I lose everything we just worked on. There's no 'Save' button — the only way to persist anything is to Commit & Push to GitHub, which pollutes git history with half-finished work and requires me to write a commit message every few minutes just to feel safe. And when I do commit, the commit shows up as if I wrote it alone, even though my teammate wrote half of it. If I realize I committed something wrong, there's no way to undo it from inside CodeSync — I have to drop into a terminal and `git revert` myself."

Concretely, four problems:

1. **No safety net for in-session work.** Edits only live in Yjs memory and the y-websocket server's RAM. A crash, a server restart, or an accidental tab close loses everything since the last commit.
2. **No Save button.** Users expect one. The only persistence path today is "Commit & Push," which is the wrong granularity for moment-to-moment safety.
3. **Co-authorship is broken.** An existing scaffold (`fileEditors` subcollection + `buildCommitMessage`) tries to attribute commits, but it fires on *tab open*, not on *typing*. Lurkers who just opened a file get credited as co-authors. Real contributors who typed in files they didn't open don't get credit.
4. **No way to undo a commit from inside the app.** If you push something wrong, you're out of the CodeSync flow entirely and have to fix it in git.

## Solution

From the user's perspective:

> "There's a **Save** button in the session header next to Commit & Push. It saves a snapshot of everyone's in-progress work to a safe place, separate from git. And it autosaves every couple of seconds of idle time so I don't even have to remember. If my browser crashes, I reopen the session and my work is right where I left it. When I finally Commit & Push, the commit lists every teammate who actually typed something as a co-author — GitHub shows multiple avatars on the commit. And there's a **History** button next to it showing the last 30 commits on the branch; if I committed something wrong, I click Revert on the offending commit, confirm, and a clean reverting commit shows up on GitHub. It never force-pushes, never rewrites history, and warns me if a revert would conflict with later changes."

Four features, one coherent workflow:

1. **Draft save** — manual button + autosave, persists to Firebase Storage as a safety net. Not a commit.
2. **Autosave with leader election** — one participant per session runs the autosave timer; the rest piggyback.
3. **Edit-based co-author tracking** — session tracks "who typed something," attached as `Co-Authored-By:` trailers on commits.
4. **History & revert** — list the last 30 commits on the branch with per-commit Revert buttons that do safe "git revert" semantics (new commit, no history rewrite, conflict detection up front).

## User Stories

1. As a developer in a CodeSync session, I want a **Save** button in the header next to Commit & Push, so I can manually snapshot my in-progress work at any time without pushing to git.
2. As a developer in a session, I want my edits to **autosave silently every few seconds of idle time**, so I don't have to remember to hit Save.
3. As a developer, I want the autosave to **run in only one browser at a time across the session's participants**, so we don't generate N concurrent uploads of the same content every time anyone types.
4. As a developer, I want **autosave to continue working if the current "leader" browser is closed**, so we don't lose the safety net when someone leaves.
5. As a developer, I want the Save button to **bypass the autosave debounce and fire immediately**, so I can force an instant save when I know I'm about to close the tab.
6. As a developer, I want the Save button to be **disabled when there are no unsaved changes**, so I get visual feedback on whether a save is needed.
7. As a developer, I want to see a **"Saved Ns ago" indicator in the status bar**, so I always know how fresh my persisted state is.
8. As a developer, I want **"Saving…"** feedback during an in-flight save and **"Save failed"** feedback with a toast on error, so I can retry or investigate.
9. As a developer, I want **any participant to be able to hit Save**, not just the session owner, so nobody's work is stranded if the owner is idle.
10. As a developer, I want Save to **upload the full current state of every file that's been modified in the session**, not just the files I personally have open, so a single Save captures everyone's edits.
11. As a developer whose browser just crashed, I want to **reopen the session URL and see my in-progress work restored automatically**, so I can pick up where I left off without any manual action.
12. As a developer, I want the restore flow to **prefer live Yjs state first, then draft, then GitHub**, so I never accidentally overwrite a teammate's live edits with a stale draft.
13. As a developer, I want a **stale draft (whose GitHub sha has moved since the draft was taken) to be discarded with a toast**, so outside-of-CodeSync commits from a teammate aren't silently clobbered.
14. As a developer, I want drafts to be **automatically deleted after a successful Commit & Push**, so the Storage layer doesn't accumulate dead drafts for committed work.
15. As a developer, I want a **7-day TTL on abandoned drafts** (drafts for sessions that never got committed), so Storage doesn't grow forever.
16. As a session participant who just typed something, I want to **automatically be recorded as a contributor** to the session, so I get credit when the session's work is committed.
17. As a session participant who only joined to watch, I want to **not be recorded as a contributor until I actually type something**, so I don't get falsely attributed as a co-author on someone else's work.
18. As a developer committing a session's work, I want the **commit message to automatically include `Co-Authored-By:` trailers** for every contributor who typed during the session (excluding myself — I'm already the author), so GitHub's commit UI shows multiple avatars and the credit is correct.
19. As a developer, I want contributor names and emails for the co-author trailers to come from the **Firestore user doc** (auto-backfilled from Firebase Auth when missing), so the attribution always works even for legacy accounts.
20. As a session owner, I want a **History button in the header next to Commit & Push**, so I can browse recent commits without leaving the session.
21. As a session owner, I want the history list to show **the last 30 commits on the current branch** — not just commits made in this session — so I can revert work from any recent point in the repo's history.
22. As a session owner, I want each commit in the history to show its **sha, message, author name, author avatar, and relative timestamp**, so I can identify which commit I want to revert.
23. As a session owner, I want commits **made in the current session to be visually distinct** from commits made elsewhere (different button color), so I'm reminded when I'm about to affect someone else's work.
24. As a session owner, I want clicking Revert to **show a confirmation prompt with the commit's author name**, so I never accidentally revert a teammate's work without realizing whose work it is.
25. As a session owner, I want a revert to **create a new reverting commit on the branch** using "git revert" semantics, so commit history is preserved and nobody else's clone breaks.
26. As a session owner, I want the revert flow to **never force-push**, because force-pushing is destructive and breaks collaborators.
27. As a session owner, I want the server to **detect merge conflicts up front, before writing any commit to GitHub**, so I get a clean error listing conflicting paths instead of a half-applied revert.
28. As a session owner reverting a commit, I want the **session's Yjs state to be updated to match the new branch HEAD**, so everyone in the session sees the rewind instantly.
29. As a session owner, I want to be **prompted when reverting would lose in-session edits that came after the commit**, with a choice to keep them (possibly conflicting) or discard them, so I'm never surprised by silent data loss.
30. As a non-owner session participant, I want to **see the commit history but have Revert buttons disabled**, because only owners have the GitHub access token — but I should still see what's happening.
31. As a session participant, I want a **chat system message to appear when someone reverts a commit**, so I know why the editor content just changed.
32. As a session owner, I want **revert commits to appear in the history list as normal entries and be revertable themselves**, so I can re-apply a change if I reverted it by mistake.
33. As a developer, I want the draft save feature to **not require changing Firebase Storage security rules**, because rules for Storage aren't defined in this repo — all Storage writes should go through server routes using the Admin SDK.

## Implementation Decisions

### Feature scope

- **Draft save is crash-recovery-only.** No version history, no multi-snapshot timeline. One draft per path, overwritten on every save.
- **Version history lives on the git side only.** The History modal shows the last 30 commits on the branch; there is no "in-session draft history."
- **Ctrl+Z (y-monaco shared undo) handles intra-session undo.** No additional in-app undo surface.

### Persistence layers (who owns what)

| Data                         | Home                                                 | Lifetime                              |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------- |
| Live editing state           | Yjs doc (y-websocket server RAM)                     | Session duration                      |
| Crash recovery snapshot      | Firebase Storage `drafts/{sessionId}/{path}`         | Until commit, or 7d TTL fallback      |
| Committed work               | GitHub via Git Tree API                              | Forever                               |
| Session metadata             | Firestore `sessions/{id}`                            | Until session closed                  |
| Who-typed-what (contributor) | Firestore `sessions/{id}.contributors` (new field)   | Until session closed                  |

### Firestore schema changes

- **`sessions/{id}`** gains a new field `contributors: { [uid]: { firstEditAt: Timestamp } }`. New sessions initialize it as `{}`.
- **`sessions/{id}.lastDraftAt`** already exists on `SessionDoc` but is currently always `null`; it starts getting written on each draft save and cleared on commit.
- **`sessions/{id}.commits: string[]`** is a new field. Every successful commit in `POST /api/commits` appends its new sha to this array. Used by the History modal to color-code "own" vs "external" commits.
- **The existing `sessions/{id}/fileEditors` subcollection** and the `useFileEditorTracking` hook that populates it are **removed**. Their tab-open-based tracking is replaced by the new edit-based `contributors` map.

### Firebase Storage layout

```
drafts/
  {sessionId}/
    {path}          # e.g. drafts/abc-123/src/app/page.tsx
```

Object metadata per file:

- `originalSha` — the GitHub sha of this file at session creation time (copied from `session.files[].sha`)
- `uploadedBy` — the uid of the client that wrote this draft
- `uploadedAt` — ISO timestamp

**Lifecycle rule (manual Firebase console setup, documented in the PR):** delete objects under `drafts/*` older than 7 days.

### New API endpoints

1. **`POST /api/sessions/[id]/drafts`** — upload a batch of files to drafts. Body: `{ files: [{ path, content, originalSha }] }`. Server writes via Admin Storage, updates `lastDraftAt`. Any participant/owner may call.
2. **`POST /api/sessions/[id]/mark-contributor`** — idempotently record the caller as a contributor on the session doc. Empty body.
3. **`GET /api/repos/[owner]/[repo]/commits?branch=&limit=`** — list recent commits on a branch via GitHub API. Returns a cleaned-up shape with sha, shortSha, message first-line, author `{ name, email, avatarUrl, login }`, committedAt, and the GitHub URL.
4. **`POST /api/commits/revert`** — revert a commit. Body: `{ sessionId, sha }`. Owner-only. Performs conflict detection before writing; returns a structured `MERGE_CONFLICT` error listing conflicting paths when the revert can't be applied cleanly.
5. **Draft deletion is folded into the existing `POST /api/commits`** — on successful push, the handler deletes `drafts/{sessionId}/*` and clears `lastDraftAt`. No separate endpoint.

### Firebase Admin expansion

`src/lib/firebase/admin.ts` currently exports `adminAuth` and `adminDb`. Add `adminStorage` for server-side draft writes/deletes.

### Deep modules

Modules extracted with simple interfaces hiding complex logic, making the code easier to reason about during review:

1. **`DraftStore`** — façade over Firebase Admin Storage for draft persistence.
   - Interface: `saveDraft(sessionId, files)`, `loadDraft(sessionId)`, `deleteSessionDrafts(sessionId)`
   - Hides: bucket paths, metadata serialization, batch writes, batch deletion, error normalization, retries

2. **`YDocDiffer`** — pure function over a Y.Doc.
   - Interface: `diffAgainstOriginal(ydoc, originals) → FileChange[]`
   - Hides: walking `ydoc.share`, reading `Y.Text` entries, comparing to originals, filtering unchanged files
   - Used by both "what does Save upload?" and "what does Commit send to GitHub?"

3. **`AutosaveCoordinator`** — orchestrates leader election + debounce + ceiling logic.
   - Interface: constructor `{ ydoc, awareness, myClientID, onSave, debounceMs, ceilingMs }` + `start() → dispose`
   - Hides: leader election via awareness state comparison, debounce timer, ceiling timer, re-election on leader disconnect, ignoring non-local updates when not leader

4. **`CommitReverter`** — hides the Git Tree API juggling for revert.
   - Interface: `revertCommit({ token, owner, repo, branch, sha }) → { newSha } | { conflicts: string[] }`
   - Hides: fetching commit + parent, computing reverted tree, conflict detection by walking both trees against current HEAD, creating blobs/tree/commit, pushing the new ref

### Autosave mechanics

- **Leader election:** each participant publishes its Yjs `clientID` via awareness (y-websocket already does this for free). The participant with the **lowest** `clientID` is the leader. Deterministic — every client independently computes the same leader without any coordination. When the leader's awareness state disappears (disconnect/tab close), the next client takes over on the next awareness tick.
- **Trigger:** `ydoc.on('update', ...)` on the leader's client. 2-second debounce (resets on every update). 30-second ceiling so a non-stop typist still produces saves.
- **Scope:** every autosave tick, the leader runs `YDocDiffer.diffAgainstOriginal` and uploads every file whose content differs from its original GitHub content. No attempt to track "which files changed since last tick" — the whole delta against GitHub is the source of truth.

### Contributor tracking mechanics

- Each client observes `ydoc.on('update', (_, origin) => ...)` for **local-origin updates only** (updates where `origin === provider` or a local transaction, not remote peer updates).
- On the first local update after mount, the client calls `POST /api/sessions/[id]/mark-contributor` once, guarded by a `useRef` flag.
- The server writes `sessions/{id}.contributors.{uid}.firstEditAt = serverTimestamp()` via Firestore `update` with dot notation.

### Co-author trailer generation

- The existing `buildCommitMessage` logic is **rewritten** to read from `session.contributors` (the new edit-based map) instead of `sessions/{id}/fileEditors` (the old tab-open-based subcollection).
- For each contributor uid that is NOT the committer, the server calls `ensureUserDoc(uid)` to resolve a `{ name, email }` pair.
- Emails fall back to `{login}@users.noreply.github.com` when the user's stored email is empty, matching the GitHub noreply email format.
- Trailers format: `Co-Authored-By: Name <email>`, one per line, appended to the user's commit message after a blank line — the git convention GitHub parses for its multi-author commit UI.

### Draft restore on page load

Per file opened from the file tree, the priority order is:

1. **Yjs Y.Text** if it already has content → use that. A live collaborator is editing; their state is newest.
2. **Draft at `drafts/{sessionId}/{path}`** — if the draft's stored `originalSha` matches the current GitHub sha for the file, seed the Y.Text with the draft content and open the tab.
3. **GitHub API** — current behavior. Fetch the file contents fresh.

Stale drafts (sha mismatch, meaning someone pushed directly to GitHub while the session was idle) are deleted on first observation and a toast is shown.

### Revert flow details

- **Conflict detection** compares the computed reverted tree against the current branch HEAD tree. For files touched by the commit being reverted, if HEAD's version has drifted from the commit's own post-state, those files are reported as conflicts. Detection happens **before any write to GitHub**.
- **Visual distinction in the History modal:** the server tracks `session.commits: string[]` — every successful commit in `POST /api/commits` appends its new sha. The History modal colors Revert buttons green for shas in this array ("your own") and yellow for shas not in it.
- **Owner-gating:** non-owners see the history list but Revert buttons are disabled with a tooltip explaining that only the session owner has the GitHub access token.
- **Confirmation prompt** always shows the commit's author name pulled from the GitHub API response: *"Revert 'Fix auth' by Carol Smith? This will create a new commit on main that undoes Carol's changes. Carol will see this on her next pull."*
- **Post-revert Yjs reconciliation:** after a successful revert, compare the current Yjs state to the reverted content. If they match (happy path — owner reverted immediately after committing with no further edits), silently reset the Yjs doc to the new HEAD. If they diverge (in-session edits were made after the commit), prompt the owner: *"Your session has unsaved changes that came after this commit. Keep them (they may conflict with the reverted state) or discard them?"*
- **Chain revert:** revert commits are normal GitHub commits and appear in the history list like any other; nothing special needs to be done to support reverting a revert.
- **Chat broadcast:** a system chat message is posted after every successful revert: *"<username> reverted commit <shortSha> '<original message>'."*

### UI placement

Header button order (left → right): **Share | Save | History | Commit & Push | Leave**

- **Save** is placed next to Commit & Push because they're both persistence actions.
- **History** is placed between Save and Commit & Push to group all the "look at past states / rewind" affordances.
- **Leave** stays rightmost, unchanged.

Status bar (bottom) gains a **"Saved Ns ago" / "Saving…" / "Save failed"** indicator between the connection status and the language/tab-size labels.

### Rollout phases (independently shippable)

1. **Phase 1 — Draft save (manual only).** Save button, `POST /api/sessions/[id]/drafts`, `DraftStore`, `YDocDiffer`, admin-storage wiring, restore-on-load, delete-on-commit integration. No autosave yet.
2. **Phase 2 — Autosave with leader election.** `AutosaveCoordinator`, `useAutosaveLeader` and `useAutosave` hooks, mount in session page. Reuses Phase 1 endpoint.
3. **Phase 3 — Edit-based contributor tracking.** Remove the old `useFileEditorTracking` hook and `fileEditors` subcollection read. New `POST /api/sessions/[id]/mark-contributor` endpoint. Rewrite `buildCommitMessage` to read from `session.contributors`.
4. **Phase 4 — History & commit revert.** `GET /api/repos/[owner]/[repo]/commits`, `POST /api/commits/revert`, `CommitReverter` module, `HistoryModal`, `useCommitHistory` hook, owner-gated Revert buttons with conflict detection and Yjs reconciliation.

## Testing Decisions

No automated tests will be written as part of this feature. The repo currently has no test runner configured (only `lint`), and the scope of adding one — plus the module-extraction tax that testing would impose — was judged out of scope by the requester.

Manual acceptance criteria per phase are documented in the phased rollout section of Implementation Decisions. Each phase is independently shippable and should be manually verified end-to-end before moving on to the next.

The deep modules (`DraftStore`, `YDocDiffer`, `AutosaveCoordinator`, `CommitReverter`) are still extracted with clean interfaces even though they're not under automated test, because the simple-interface / hidden-complexity shape makes them easier to reason about during code review and easier to test later if a test runner is adopted.

## Out of Scope

- **Draft version history / multi-snapshot timeline.** Only one draft per file is kept; it's overwritten on each save. Users who want to rewind to an earlier point use Ctrl+Z in the editor (y-monaco shared undo) or revert the containing commit after pushing.
- **Reverting a subset of files from a commit.** The Revert button reverts the entire commit atomically. Partial revert is a power-user feature that belongs in a terminal, not this UI.
- **Multi-commit batch revert.** Each Revert click reverts one commit. If a user wants to undo multiple, they click Revert multiple times, newest first.
- **Force-push, `git reset --hard`, or any other history-rewriting operation.** Never offered. The only revert path is an additive new commit.
- **Custom commit authorship.** The committer is always the currently authenticated session owner — you can't commit "as" someone else, even if they're a session contributor. They appear as co-authors only.
- **Saving drafts for files that have never been touched in the session.** If no keystroke ever hit the Y.Doc for a given file, there's nothing to save; the file remains whatever GitHub has.
- **Firebase Storage security rules.** The feature relies on Admin-SDK-only writes from server routes; Storage rules are left untouched. Proper client-side Storage rules are a separate concern tracked elsewhere.
- **Automated test runner setup.** See Testing Decisions.
- **A "close session" UX or session archive.** Sessions remain `active: true` in Firestore indefinitely; the 7-day Storage TTL catches abandoned drafts regardless.
- **Real-time update of the History modal when new commits land.** The modal fetches on open; users can refresh it manually.

## Further Notes

- **The existing `fileEditors` subcollection and `useFileEditorTracking` hook are being deliberately removed, not extended.** Their tab-open-based tracking is incorrect (lurkers get credited) and we're replacing it with edit-based tracking via a new `contributors` map. Any data in `fileEditors` today is thrown away; we're at zero users in production so there's nothing to migrate.
- **The existing `buildCommitMessage` function is rewritten to use the new data source.** Its signature and call site (`POST /api/commits`) stay the same.
- **`POST /api/commits` already clears `lastDraftAt: null` after a successful push.** We extend that to also delete the Storage objects under `drafts/{sessionId}/*`.
- **The y-websocket switch is a prerequisite for autosave leader election.** Leader election relies on stable `clientID`s + awareness states flowing reliably between peers, which y-webrtc over the public signaling server couldn't guarantee. With the self-hosted y-websocket server now in place, this prerequisite is satisfied.
- **`ensureUserDoc` is the single source of truth for resolving uid → name/email** in all server code that touches user profiles. The co-author trailer generation uses it; this means legacy accounts without a `/users/{uid}` doc still get proper attribution because `ensureUserDoc` backfills from the Firebase Auth UserRecord.
