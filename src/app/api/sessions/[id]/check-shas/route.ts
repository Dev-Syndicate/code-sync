// POST /api/sessions/[id]/check-shas
//
// Returns the current GitHub blob SHA for each requested file path,
// based on a fresh recursive tree fetch of the session's branch. Used
// by the Commit flow to detect lost-update conflicts before pushing:
// if any dirty file's local originalSha doesn't match GitHub's current
// blob SHA, a peer (or the user themselves from another session) has
// modified that file since editing began, and we should warn before
// overwriting.
//
// Request body:
//   { paths: string[] }
//
// Response:
//   { shas: Record<string, string | null> }
//     — null means the path no longer exists on GitHub (upstream delete).
//     — paths not in the request are omitted from the response.

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext, getGitHubToken } from '@/lib/api/auth'
import { adminDb } from '@/lib/firebase/admin'
import { GitHubApiError } from '@/lib/github/api'
import { fetchRepoFiles } from '@/lib/github/repos'

export async function POST(
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

  // 2. Parse body
  let body: { paths?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body.', 400)
  }

  const rawPaths = body.paths
  if (!Array.isArray(rawPaths)) {
    return apiError('VALIDATION_ERROR', 'paths must be an array.', 400)
  }
  const paths: string[] = []
  for (const p of rawPaths) {
    if (
      typeof p !== 'string' ||
      !p.trim() ||
      p.includes('..') ||
      p.startsWith('/')
    ) {
      return apiError('VALIDATION_ERROR', 'Invalid path in request.', 400)
    }
    paths.push(p)
  }

  // Empty paths → trivially empty result.
  if (paths.length === 0) {
    return apiSuccess({ shas: {} as Record<string, string | null> })
  }

  // 3. Session membership
  const { id: sessionId } = await params
  if (!sessionId) {
    return apiError('VALIDATION_ERROR', 'Session id is required.', 400)
  }

  let sessionSnap
  try {
    sessionSnap = await adminDb.collection('sessions').doc(sessionId).get()
  } catch (err) {
    console.error(
      '[POST /api/sessions/[id]/check-shas] firestore read failed:',
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

  // 4. Session owner's token (same rationale as refresh-tree and commits)
  let token: string
  try {
    token = await getGitHubToken(sessionData.owner)
  } catch {
    return apiError(
      'GITHUB_ERROR',
      isOwner
        ? 'GitHub token not found. Please sign in again.'
        : 'Session owner is not signed in to GitHub — cannot check SHAs.',
      isOwner ? 401 : 503
    )
  }

  // 5. One recursive tree fetch gives us every path → blob SHA in the
  //    branch. We then project just the paths the client asked about.
  //    Doing per-path /contents calls would be N round-trips; this is 1.
  let shaByPath: Record<string, string>
  try {
    const raw = await fetchRepoFiles(token, repoOwner, repoName, branch)
    shaByPath = Object.fromEntries(raw.map((f) => [f.path, f.sha]))
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return apiError(
        'GITHUB_ERROR',
        `Failed to check remote SHAs: ${err.message}`,
        502
      )
    }
    console.error(
      '[POST /api/sessions/[id]/check-shas] fetchRepoFiles failed:',
      err
    )
    return apiError(
      'INTERNAL_ERROR',
      'Failed to check remote SHAs.',
      500
    )
  }

  const result: Record<string, string | null> = {}
  for (const p of paths) {
    result[p] = shaByPath[p] ?? null
  }
  return apiSuccess({ shas: result })
}
