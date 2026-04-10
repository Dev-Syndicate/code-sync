// POST /api/commits
// Full commit & push flow with auto-generated co-author credits.
//
// Body: CommitPayload {
//   sessionId, files, userMessage, committerId, repoOwner, repoName
// }

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext, getGitHubToken } from '@/lib/api/auth'
import { buildCommitMessage } from '@/lib/github/buildCommitMessage'
import { commitFiles } from '@/lib/github/commits'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { GitHubApiError } from '@/lib/github/api'
import type { CommitPayload } from '@/types/github'

export async function POST(req: NextRequest) {
  // 1. Auth
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  // 2. Parse & validate body
  let body: CommitPayload
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', 400)
  }

  const { sessionId, files, userMessage, committerId, repoOwner, repoName } = body

  if (!sessionId || !files?.length || !userMessage || !committerId || !repoOwner || !repoName) {
    return apiError(
      'VALIDATION_ERROR',
      'sessionId, files, userMessage, committerId, repoOwner, and repoName are required.',
      400
    )
  }

  if (committerId !== uid) {
    return apiError('FORBIDDEN', 'committerId must match authenticated user.', 403)
  }

  // 3. Verify the committer is the session owner
  const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get()
  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }

  const sessionData = sessionSnap.data()!
  if (!sessionData.active) {
    return apiError('SESSION_CLOSED', 'This session is no longer active.', 400)
  }
  if (sessionData.owner !== uid) {
    return apiError('FORBIDDEN', 'Only the session owner can commit.', 403)
  }

  // 4. Get GitHub token
  let token: string
  try {
    token = await getGitHubToken(uid)
  } catch {
    return apiError('GITHUB_ERROR', 'GitHub token not found. Please sign in again.', 401)
  }

  // 5. Build commit message with co-author credits
  let commitMessage: string
  try {
    commitMessage = await buildCommitMessage(sessionId, committerId, userMessage)
  } catch {
    // Non-fatal — fall back to plain message
    commitMessage = userMessage
  }

  // 6. Commit to GitHub via Git Tree API
  let commitSha: string
  try {
    commitSha = await commitFiles({
      token,
      owner:   repoOwner,
      repo:    repoName,
      branch:  sessionData.branch ?? 'main',
      files,
      message: commitMessage,
    })
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return apiError('COMMIT_FAILED', err.message, 502)
    }
    return apiError('COMMIT_FAILED', 'Failed to commit files to GitHub.', 500)
  }

  // 7. Post system message to chat
  const userDoc = await adminDb.collection('users').doc(uid).get()
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
        message:     `Committed: ${userMessage}`,
        type:        'system',
        systemEvent: 'commit',
        timestamp:   FieldValue.serverTimestamp(),
      })
  }

  // 8. Update session's lastDraftAt to null (draft deleted after commit)
  await adminDb.collection('sessions').doc(sessionId).update({
    lastDraftAt: null,
  })

  return apiSuccess({ commitSha, message: commitMessage })
}
