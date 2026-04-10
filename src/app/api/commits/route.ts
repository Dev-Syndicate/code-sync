// POST /api/commits
// Full commit & push flow with auto-generated co-author credits.
//
// Payload shape (as sent by CommitModal/Dev 3):
// {
//   sessionId: string
//   message:   string
//   files:     { path: string; content: string; sha: string }[]
// }
//
// Repo owner/name, branch, and committer are derived server-side from the session doc.

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext, getGitHubToken } from '@/lib/api/auth'
import { buildCommitMessage } from '@/lib/github/buildCommitMessage'
import { commitFiles, listCommits } from '@/lib/github/commits'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { GitHubApiError } from '@/lib/github/api'
import { deleteSessionDrafts } from '@/lib/drafts/DraftStore'
import type { CommitFile } from '@/types/github'

// ── GET /api/commits?sessionId=… ──────────────────────────────────────────────
// Returns the latest 30 commits on the session's branch. Used by the History
// modal. Any participant or the owner can read; non-members get 403.
//
// Token: we use the session OWNER's GitHub token so the listing works for
// private repos even when a participant (who has no access) is the caller.
// Same trust model as POST / revert.
export async function GET(req: NextRequest) {
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) {
    return apiError('VALIDATION_ERROR', 'sessionId is required.', 400)
  }

  const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get()
  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }
  const sessionData = sessionSnap.data()!

  const ownerUid    = sessionData.owner as string
  const isOwner     = ownerUid === uid
  const participants = (sessionData.participants ?? {}) as Record<string, unknown>
  const isParticipant = uid in participants
  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a member of this session.', 403)
  }

  const repoOwner = sessionData.repoOwner as string
  const repoName  = sessionData.repo      as string
  const branch    = (sessionData.branch as string) || 'main'

  let token: string
  try {
    token = await getGitHubToken(ownerUid)
  } catch {
    return apiError(
      'GITHUB_ERROR',
      'Session owner is not signed in to GitHub.',
      503,
    )
  }

  try {
    const commits = await listCommits(token, repoOwner, repoName, branch, 30)
    return apiSuccess({ commits })
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return apiError('GITHUB_ERROR', err.message, 502)
    }
    console.error('[GET /api/commits] listCommits failed:', err)
    return apiError('GITHUB_ERROR', 'Failed to load commit history.', 500)
  }
}

interface CommitRequestBody {
  sessionId: string
  message:   string
  files:     (CommitFile & { sha?: string })[]
  /** Paths to remove from the repo in this commit. Each gets translated
   *  into a `sha: null` Git Tree API entry. Optional; defaults to []. */
  deletes?:  string[]
}

export async function POST(req: NextRequest) {
  // 1. Auth — get the current user from the session cookie (uid)
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  // 2. Parse & validate body
  let body: CommitRequestBody
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', 400)
  }

  const { sessionId, message, files, deletes = [] } = body

  if (!sessionId || !message?.trim()) {
    return apiError('VALIDATION_ERROR', 'sessionId and message are required.', 400)
  }

  // A commit must do SOMETHING — either upsert files or remove paths.
  if (!files?.length && deletes.length === 0) {
    return apiError(
      'VALIDATION_ERROR',
      'No files to commit and no deletes requested.',
      400
    )
  }

  // Lightly validate deletes: strings, non-empty, no path-traversal weirdness.
  if (
    !Array.isArray(deletes) ||
    deletes.some(
      (p) =>
        typeof p !== 'string' ||
        !p.trim() ||
        p.includes('..') ||
        p.startsWith('/')
    )
  ) {
    return apiError('VALIDATION_ERROR', 'Invalid deletes payload.', 400)
  }

  // 3. Load session doc — get repo details and verify ownership
  const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get()
  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }

  const sessionData = sessionSnap.data()!

  if (!sessionData.active) {
    return apiError('SESSION_CLOSED', 'This session is no longer active.', 400)
  }

  // Authorization: owner OR any participant listed in the session.
  //
  // Non-owners push under the OWNER's GitHub token (step 4 below), because
  // the owner is the one with guaranteed push access to their repo. This is
  // an explicit, accepted trade-off: commits will be attributed to the owner
  // on GitHub regardless of who clicked the button, and the clicker appears
  // only in the `Co-Authored-By:` trailer. See buildCommitMessage. If this
  // ever becomes a public/multi-tenant product, switch to a per-user GitHub
  // permission check + the clicker's own token instead.
  const ownerUid = sessionData.owner as string
  const isOwner = ownerUid === uid
  const participants = (sessionData.participants ?? {}) as Record<string, unknown>
  const isParticipant = uid in participants
  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a member of this session.', 403)
  }

  const repoOwner = sessionData.repoOwner as string
  const repoName  = sessionData.repo      as string
  const branch    = (sessionData.branch as string) || 'main'

  // 4. Get GitHub token — always the SESSION OWNER's token, even when a
  // participant initiated the commit. The owner is the one guaranteed to have
  // push rights to `repoOwner/repoName`; a random joiner's token would 403.
  let token: string
  try {
    token = await getGitHubToken(ownerUid)
  } catch {
    return apiError(
      'GITHUB_ERROR',
      isOwner
        ? 'GitHub token not found. Please sign in again.'
        : 'Session owner is not signed in to GitHub — cannot push on their behalf.',
      isOwner ? 401 : 503,
    )
  }

  // 5. Build commit message with co-author credits.
  //
  // We pass `ownerUid` (not `uid`) as the committerId-to-exclude because the
  // GitHub commit will be authored by the owner regardless of who clicked.
  // If we passed `uid` here, a participant-initiated commit would exclude
  // the clicker from co-authors AND not list them as the GitHub author —
  // they'd vanish from attribution entirely. Excluding the owner instead
  // ensures every non-owner editor (including the clicker) shows up as a
  // Co-Authored-By trailer.
  let commitMessage: string
  try {
    commitMessage = await buildCommitMessage(sessionId, ownerUid, message.trim())
  } catch {
    // Non-fatal — fall back to plain message
    commitMessage = message.trim()
  }

  // 6. Commit to GitHub via Git Tree API
  const commitPayload: CommitFile[] = (files ?? []).map(({ path, content }) => ({
    path,
    content,
  }))

  let commitSha: string
  try {
    commitSha = await commitFiles({
      token,
      owner:   repoOwner,
      repo:    repoName,
      branch,
      files:   commitPayload,
      deletes,
      message: commitMessage,
    })
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return apiError('COMMIT_FAILED', err.message, 502)
    }
    return apiError('COMMIT_FAILED', 'Failed to commit files to GitHub.', 500)
  }

  // 7. Post system message to chat
  const userDoc  = await adminDb.collection('users').doc(uid).get()
  const userData = userDoc.data()

  if (userData) {
    await adminDb
      .collection('sessions')
      .doc(sessionId)
      .collection('chat')
      .add({
        userId:      uid,
        username:    userData.username,
        avatar:      userData.avatar,
        message:     `Committed: ${message.trim()}`,
        type:        'system',
        systemEvent: 'commit',
        timestamp:   FieldValue.serverTimestamp(),
      })
  }

  // 8. Update session — clear lastDraftAt marker
  await adminDb.collection('sessions').doc(sessionId).update({
    lastDraftAt: null,
  })

  // 9. Delete session drafts from Storage (fire-and-forget — don't fail commit on Storage errors)
  try {
    await deleteSessionDrafts(sessionId)
  } catch (err) {
    console.error('[POST /api/commits] Failed to delete drafts:', err)
  }

  return apiSuccess({ commitSha, message: commitMessage })
}
