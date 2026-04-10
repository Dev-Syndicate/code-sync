// POST /api/commits/revert
// Reverts a commit by creating a new inverse commit on top of HEAD.
// No force-push, no history rewrite. Conflicts are refused, not merged.
//
// Payload:
// {
//   sessionId: string
//   commitSha: string   // the commit to revert
// }
//
// Auth model mirrors POST /api/commits exactly:
//   - Owner OR any session participant can trigger a revert.
//   - The inverse commit is pushed under the session OWNER's GitHub token
//     (owner is the one with guaranteed push rights to their repo).
//   - GitHub author is the owner; every other participant shows up in
//     Co-Authored-By trailers via buildCommitMessage.
//   - The chat "Reverted: …" system message names the clicker so there
//     is still a readable audit trail in the session chat.

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext, getGitHubToken } from '@/lib/api/auth'
import { buildCommitMessage } from '@/lib/github/buildCommitMessage'
import { revertCommit, RevertConflictError } from '@/lib/github/commits'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { GitHubApiError } from '@/lib/github/api'

interface RevertRequestBody {
  sessionId: string
  commitSha: string
}

export async function POST(req: NextRequest) {
  // 1. Auth
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  // 2. Parse body
  let body: RevertRequestBody
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', 400)
  }
  const { sessionId, commitSha } = body
  if (!sessionId || !commitSha) {
    return apiError('VALIDATION_ERROR', 'sessionId and commitSha are required.', 400)
  }

  // 3. Load session and authorize (owner OR participant)
  const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get()
  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }
  const sessionData = sessionSnap.data()!

  if (!sessionData.active) {
    return apiError('SESSION_CLOSED', 'This session is no longer active.', 400)
  }

  const ownerUid     = sessionData.owner as string
  const isOwner      = ownerUid === uid
  const participants = (sessionData.participants ?? {}) as Record<string, unknown>
  const isParticipant = uid in participants
  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a member of this session.', 403)
  }

  const repoOwner = sessionData.repoOwner as string
  const repoName  = sessionData.repo      as string
  const branch    = (sessionData.branch as string) || 'main'

  // 4. Fetch the OWNER's GitHub token (see module comment for why)
  let token: string
  try {
    token = await getGitHubToken(ownerUid)
  } catch {
    return apiError(
      'GITHUB_ERROR',
      isOwner
        ? 'GitHub token not found. Please sign in again.'
        : 'Session owner is not signed in to GitHub — cannot revert on their behalf.',
      isOwner ? 401 : 503,
    )
  }

  // 5. Build the inverse commit message. We use a short headline in the
  //    `Revert "<sha>"` style and let buildCommitMessage append co-author
  //    trailers (with ownerUid excluded, same as POST /api/commits does).
  //
  //    We don't fetch the original commit's message here to keep this
  //    function cheap — the client already has the message from the listing
  //    and puts a friendly version in the UI. The audit trail lives in chat.
  const shortSha  = commitSha.slice(0, 7)
  const baseMsg   = `Revert ${shortSha}\n\nThis reverts commit ${commitSha}.`
  let commitMessage: string
  try {
    commitMessage = await buildCommitMessage(sessionId, ownerUid, baseMsg)
  } catch {
    commitMessage = baseMsg
  }

  // 6. Perform the revert via Git Tree API.
  try {
    const result = await revertCommit({
      token,
      owner:     repoOwner,
      repo:      repoName,
      branch,
      targetSha: commitSha,
      message:   commitMessage,
    })

    // 7. Post a system chat message naming the CLICKER, not the owner,
    //    so the audit trail in chat tells you who actually pressed Revert.
    try {
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
            message:     `Reverted commit ${shortSha}`,
            type:        'system',
            systemEvent: 'revert',
            timestamp:   FieldValue.serverTimestamp(),
          })
      }
    } catch (err) {
      // Non-fatal — the revert already succeeded on GitHub.
      console.error('[POST /api/commits/revert] chat message failed:', err)
    }

    return apiSuccess({
      commitSha:     result.commitSha,
      affectedFiles: result.affectedFiles,
    })
  } catch (err) {
    if (err instanceof RevertConflictError) {
      return apiError('REVERT_CONFLICT', err.message, 409)
    }
    if (err instanceof GitHubApiError) {
      return apiError('REVERT_FAILED', err.message, 502)
    }
    console.error('[POST /api/commits/revert] revert failed:', err)
    return apiError('REVERT_FAILED', 'Failed to revert commit.', 500)
  }
}
