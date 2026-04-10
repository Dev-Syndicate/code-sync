// POST /api/sessions/[id]/join
// Adds the authenticated user to the session's participants map so they
// can be authorized by GET /api/sessions/[id] and see the file tree.
//
// Idempotent: calling this when the user is already a participant (or is
// the owner) is a no-op that still returns 200. That means the session
// page can unconditionally POST to this on mount without checking first.

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext } from '@/lib/api/auth'
import { ensureUserDoc } from '@/lib/api/ensureUserDoc'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { CURSOR_COLORS } from '@/types/session'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch (err) {
    console.error('[POST /api/sessions/[id]/join] auth failed:', err)
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  const { id } = await params
  if (!id) {
    return apiError('VALIDATION_ERROR', 'Session id is required.', 400)
  }

  const sessionRef = adminDb.collection('sessions').doc(id)

  let sessionSnap
  try {
    sessionSnap = await sessionRef.get()
  } catch (err) {
    console.error('[POST /api/sessions/[id]/join] session read failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to load session.', 500)
  }

  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }

  const session = sessionSnap.data() as {
    active: boolean
    owner: string
    maxParticipants: number
    participants?: Record<string, unknown>
  }

  if (!session.active) {
    return apiError('FORBIDDEN', 'This session has been closed.', 403)
  }

  // Owner doesn't need to be in the participants map — they're always
  // authorized. Treat this as a successful no-op.
  if (session.owner === uid) {
    return apiSuccess({ joined: false, reason: 'owner' })
  }

  // Already a participant — idempotent no-op.
  if (session.participants && uid in session.participants) {
    return apiSuccess({ joined: false, reason: 'already-participant' })
  }

  // Enforce participant cap.
  const currentCount = Object.keys(session.participants ?? {}).length
  if (currentCount >= session.maxParticipants) {
    return apiError('FORBIDDEN', 'Session is full.', 403)
  }

  // Look up the user's display name and avatar. ensureUserDoc reads the
  // /users/{uid} doc, or backfills it from the Firebase Auth record if
  // it's missing (legacy accounts, failed client writes, etc.) — so this
  // route no longer 404s on half-provisioned users.
  let userData: { username: string; avatar: string }
  try {
    const ensured = await ensureUserDoc(uid)
    userData = { username: ensured.username, avatar: ensured.avatar }
  } catch (err) {
    console.error('[POST /api/sessions/[id]/join] ensureUserDoc failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to load user profile.', 500)
  }

  // Cycle through the cursor palette so each participant gets a distinct
  // color without clashing with the owner (who always gets CURSOR_COLORS[0]).
  const color = CURSOR_COLORS[currentCount % CURSOR_COLORS.length]

  try {
    await sessionRef.update({
      [`participants.${uid}`]: {
        username: userData.username,
        avatar: userData.avatar,
        color,
        joinedAt: FieldValue.serverTimestamp(),
      },
    })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/join] update failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to join session.', 500)
  }

  // Optional: drop a "X joined the session" system message in chat so the
  // owner sees the join event without waiting for a presence tick.
  try {
    await sessionRef.collection('chat').add({
      userId: uid,
      username: userData.username,
      avatar: userData.avatar,
      message: `${userData.username} joined the session`,
      type: 'system',
      systemEvent: 'join',
      timestamp: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    // Non-fatal — chat message failure shouldn't block the join.
    console.error('[POST /api/sessions/[id]/join] chat write failed:', err)
  }

  return apiSuccess({ joined: true })
}
