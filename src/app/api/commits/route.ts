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
import { commitFiles } from '@/lib/github/commits'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { GitHubApiError } from '@/lib/github/api'
import type { CommitFile } from '@/types/github'

interface CommitRequestBody {
  sessionId: string
  message:   string
  files:     (CommitFile & { sha?: string })[]
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

  const { sessionId, message, files } = body

  if (!sessionId || !message?.trim()) {
    return apiError('VALIDATION_ERROR', 'sessionId and message are required.', 400)
  }

  if (!files?.length) {
    return apiError('VALIDATION_ERROR', 'No files to commit.', 400)
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

  if (sessionData.owner !== uid) {
    return apiError('FORBIDDEN', 'Only the session owner can commit.', 403)
  }

  const repoOwner = sessionData.repoOwner as string
  const repoName  = sessionData.repo      as string
  const branch    = (sessionData.branch as string) || 'main'

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
    commitMessage = await buildCommitMessage(sessionId, uid, message.trim())
  } catch {
    // Non-fatal — fall back to plain message
    commitMessage = message.trim()
  }

  // 6. Commit to GitHub via Git Tree API
  const commitPayload: CommitFile[] = files.map(({ path, content }) => ({ path, content }))

  let commitSha: string
  try {
    commitSha = await commitFiles({
      token,
      owner:   repoOwner,
      repo:    repoName,
      branch,
      files:   commitPayload,
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

  return apiSuccess({ commitSha, message: commitMessage })
}
