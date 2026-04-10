// POST /api/sessions  → Create a new session
// GET  /api/sessions  → List user's active sessions

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext, getGitHubToken } from '@/lib/api/auth'
import { ensureUserDoc } from '@/lib/api/ensureUserDoc'
import { fetchRepoFiles } from '@/lib/github/repos'
import { inferLanguage } from '@/lib/github/inferLanguage'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { GitHubApiError } from '@/lib/github/api'
import { CURSOR_COLORS } from '@/types/session'
import type { CreateSessionInput, Session } from '@/types/session'
import { randomUUID } from 'crypto'

// ── POST — Create session ─────────────────────────────────────────────────────
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
  let body: CreateSessionInput
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', 400)
  }

  const { repo, repoOwner, repoUrl, branch = 'main', owner, maxParticipants = 4 } = body as {
    repo:             string
    repoOwner:        string
    repoUrl:          string
    branch?:          string
    owner:            string
    maxParticipants?: number
  }

  if (!repo || !repoOwner || !repoUrl || !owner) {
    return apiError('VALIDATION_ERROR', 'repo, repoOwner, repoUrl, and owner are required.', 400)
  }

  if (owner !== uid) {
    return apiError('FORBIDDEN', 'Session owner must match authenticated user.', 403)
  }

  // 3. Get user profile for participant entry. ensureUserDoc backfills the
  // /users/{uid} doc from the Firebase Auth record if it's missing, so
  // legacy accounts can still create sessions.
  let token: string
  let userData: { username: string; avatar: string }
  try {
    token = await getGitHubToken(uid)
  } catch {
    return apiError('GITHUB_ERROR', 'Could not retrieve GitHub token. Please sign in again.', 401)
  }

  try {
    const ensured = await ensureUserDoc(uid)
    userData = { username: ensured.username, avatar: ensured.avatar }
  } catch (err) {
    console.error('[POST /api/sessions] ensureUserDoc failed:', err)
    return apiError('INTERNAL_ERROR', 'Could not retrieve user data.', 500)
  }

  // 4. Load repo file list from GitHub
  let files: { path: string; sha: string; language: string }[] = []
  try {
    const rawFiles = await fetchRepoFiles(token, repoOwner, repo, branch)
    files = rawFiles.map((f) => ({
      path:     f.path,
      sha:      f.sha,
      language: inferLanguage(f.path),
    }))
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return apiError('GITHUB_ERROR', `Failed to load repo files: ${err.message}`, 502)
    }
    return apiError('INTERNAL_ERROR', 'Failed to load repository files.', 500)
  }

  // 5. Create session document
  const sessionId = randomUUID()
  const sessionData = {
    repo,
    repoOwner,
    repoUrl,
    branch,
    owner: uid,
    participants: {
      [uid]: {
        username: userData.username,
        avatar:   userData.avatar,
        color:    CURSOR_COLORS[0],
        joinedAt: FieldValue.serverTimestamp(),
      },
    },
    files,
    active:          true,
    maxParticipants,
    createdAt:       FieldValue.serverTimestamp(),
    closedAt:        null,
    lastDraftAt:     null,
  }

  try {
    await adminDb.collection('sessions').doc(sessionId).set(sessionData)
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed to create session.', 500)
  }

  // 6. Post system message: "session started"
  await adminDb
    .collection('sessions')
    .doc(sessionId)
    .collection('chat')
    .add({
      userId:      uid,
      username:    userData.username,
      avatar:      userData.avatar,
      message:     `${userData.username} started the session`,
      type:        'system',
      systemEvent: 'join',
      timestamp:   FieldValue.serverTimestamp(),
    })

  const session: Session = {
    id:             sessionId,
    ...(sessionData as Omit<typeof sessionData, 'participants' | 'createdAt' | 'closedAt' | 'lastDraftAt'>),
    participants:   sessionData.participants as Session['participants'],
    createdAt:      FieldValue.serverTimestamp() as unknown as Session['createdAt'],
    closedAt:       null,
    lastDraftAt:    null,
  }

  return apiSuccess(session, 201)
}

// ── GET — List user's sessions ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch (err) {
    console.error('[GET /api/sessions] auth failed:', err)
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  try {
    // We intentionally do NOT add `.orderBy('createdAt', 'desc')` here —
    // combining it with the `active == true` filter would require a composite
    // index on (active, createdAt desc) which isn't deployed. The result set
    // is already capped at 50 and then post-filtered to sessions the user is
    // part of, so sorting in memory is cheap and keeps the dashboard working
    // without waiting on index deployment.
    const snap = await adminDb
      .collection('sessions')
      .where('active', '==', true)
      .limit(50)
      .get()

    const sessions = snap.docs
      .filter((doc) => {
        const data = doc.data()
        return data.owner === uid || uid in (data.participants ?? {})
      })
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const at = (a as { createdAt?: { toMillis?: () => number } }).createdAt?.toMillis?.() ?? 0
        const bt = (b as { createdAt?: { toMillis?: () => number } }).createdAt?.toMillis?.() ?? 0
        return bt - at
      })

    return apiSuccess(sessions)
  } catch (err) {
    console.error('[GET /api/sessions] failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to list sessions.', 500)
  }
}

// inferLanguage moved to @/lib/github/inferLanguage so the refresh-tree
// endpoint can share the same mapping.
