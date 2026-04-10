// POST /api/sessions/[id]/end
// Host-only. Marks the session closed (active: false, closedAt: now),
// posts a system chat message, and clears presence docs so the session
// doesn't linger in anyone's "online users" list.
//
// All other clients receive the active:false flip via their Firestore
// listener and redirect themselves off the session page.

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext } from '@/lib/api/auth'
import { ensureUserDoc } from '@/lib/api/ensureUserDoc'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch (err) {
    console.error('[POST /api/sessions/[id]/end] auth failed:', err)
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
    console.error('[POST /api/sessions/[id]/end] session read failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to load session.', 500)
  }

  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }

  const session = sessionSnap.data() as {
    owner: string
    active: boolean
  }

  if (session.owner !== uid) {
    return apiError('FORBIDDEN', 'Only the host can end this session.', 403)
  }

  // Idempotent — already closed.
  if (!session.active) {
    return apiSuccess({ ended: false, reason: 'already-closed' })
  }

  try {
    await sessionRef.update({
      active: false,
      closedAt: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/end] update failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to end session.', 500)
  }

  // System chat message so the history shows who ended it.
  try {
    const { username, avatar } = await ensureUserDoc(uid)
    await sessionRef.collection('chat').add({
      userId: uid,
      username,
      avatar,
      message: `${username} ended the session`,
      type: 'system',
      systemEvent: 'end',
      timestamp: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/end] chat write failed:', err)
  }

  // Best-effort presence cleanup. Presence is a subcollection at
  // presence/{sessionId}/users/{uid} in the client model, but the client
  // lib may also write at presence/{sessionId}/{uid}. Wipe both shapes.
  try {
    const batch = adminDb.batch()
    const roots = [
      adminDb.collection('presence').doc(id).collection('users'),
      adminDb.collection('presence').doc(id).collection('presence'),
    ]
    for (const col of roots) {
      const snap = await col.get()
      snap.forEach((d) => batch.delete(d.ref))
    }
    await batch.commit()
  } catch (err) {
    console.error('[POST /api/sessions/[id]/end] presence cleanup failed:', err)
  }

  return apiSuccess({ ended: true })
}
