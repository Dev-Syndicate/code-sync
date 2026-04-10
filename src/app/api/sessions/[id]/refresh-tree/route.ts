// GET /api/sessions/[id]/refresh-tree
//
// Re-fetches the session's repo file list from GitHub and returns the
// current state. Also updates the Firestore session doc so subsequent
// reopens pick up the fresh snapshot without hitting GitHub again.
//
// This is the manual "Refresh" button in the Explorer header. It exists
// because the session doc's `files` array is frozen at creation time; any
// files added/removed on GitHub after that point are invisible until
// someone triggers this endpoint.
//
// Response shape:
//   { files: [{ path, sha, language }, ...] }
//
// The client merges this against its current tree + pendingDeletes to
// figure out what's new, what's stale, and what was deleted upstream.

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext, getGitHubToken } from '@/lib/api/auth'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { GitHubApiError } from '@/lib/github/api'
import { fetchRepoFiles } from '@/lib/github/repos'
import { inferLanguage } from '@/lib/github/inferLanguage'

export interface RefreshedFile {
  path: string
  sha: string
  language: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  // 2. Session membership
  const { id: sessionId } = await params
  if (!sessionId) {
    return apiError('VALIDATION_ERROR', 'Session id is required.', 400)
  }

  let sessionSnap
  try {
    sessionSnap = await adminDb.collection('sessions').doc(sessionId).get()
  } catch (err) {
    console.error(
      '[GET /api/sessions/[id]/refresh-tree] firestore read failed:',
      err
    )
    return apiError('INTERNAL_ERROR', 'Failed to load session.', 500)
  }
  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }

  const sessionData = sessionSnap.data() as {
    owner: string
    participants?: Record<string, unknown>
    repoOwner?: string
    repo?: string
    branch?: string
  }

  const isOwner = sessionData.owner === uid
  const isParticipant =
    !!sessionData.participants && uid in sessionData.participants
  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a member of this session.', 403)
  }

  const repoOwner = sessionData.repoOwner
  const repoName = sessionData.repo
  const branch = sessionData.branch || 'main'

  if (!repoOwner || !repoName) {
    return apiError(
      'VALIDATION_ERROR',
      'Session is missing repo metadata.',
      400
    )
  }

  // 3. Use the SESSION OWNER's GitHub token. Matches the commit flow at
  //    src/app/api/commits/route.ts:154-168 — the owner is the one
  //    guaranteed to have read access, so refresh works even if a
  //    participant's own token would 403.
  let token: string
  try {
    token = await getGitHubToken(sessionData.owner)
  } catch {
    return apiError(
      'GITHUB_ERROR',
      isOwner
        ? 'GitHub token not found. Please sign in again.'
        : 'Session owner is not signed in to GitHub — cannot refresh.',
      isOwner ? 401 : 503
    )
  }

  // 4. Re-fetch the repo tree
  let refreshed: RefreshedFile[]
  try {
    const raw = await fetchRepoFiles(token, repoOwner, repoName, branch)
    refreshed = raw.map((f) => ({
      path: f.path,
      sha: f.sha,
      language: inferLanguage(f.path),
    }))
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return apiError(
        'GITHUB_ERROR',
        `Failed to refresh from GitHub: ${err.message}`,
        502
      )
    }
    console.error(
      '[GET /api/sessions/[id]/refresh-tree] fetchRepoFiles failed:',
      err
    )
    return apiError(
      'INTERNAL_ERROR',
      'Failed to refresh from GitHub.',
      500
    )
  }

  // 5. Persist the refreshed list back to the session doc so subsequent
  //    page loads pick it up without a GitHub call. Non-fatal if it fails
  //    — the client still gets the fresh data in this response.
  try {
    await adminDb.collection('sessions').doc(sessionId).update({
      files: refreshed,
      lastTreeRefreshAt: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    console.error(
      '[GET /api/sessions/[id]/refresh-tree] firestore update failed:',
      err
    )
    // Fall through — still return the fresh data.
  }

  return apiSuccess({ files: refreshed })
}
