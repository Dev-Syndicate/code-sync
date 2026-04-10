// GET /api/sessions/[id]
// Returns a single session document by ID, including its files array,
// repo metadata, participants, etc. Used by the session page to build
// the file tree in the left sidebar.
//
// Auth: requires a valid session cookie. Users can only fetch sessions
// they own or are a participant in.

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext } from '@/lib/api/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch (err) {
    console.error('[GET /api/sessions/[id]] auth failed:', err)
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  const { id } = await params
  if (!id) {
    return apiError('VALIDATION_ERROR', 'Session id is required.', 400)
  }

  let snap
  try {
    snap = await adminDb.collection('sessions').doc(id).get()
  } catch (err) {
    console.error('[GET /api/sessions/[id]] firestore read failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to load session.', 500)
  }

  if (!snap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }

  const data = snap.data() as {
    owner: string
    participants?: Record<string, unknown>
    [key: string]: unknown
  }

  // Authorization: must be owner or participant
  const isOwner = data.owner === uid
  const isParticipant = !!data.participants && uid in data.participants
  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a member of this session.', 403)
  }

  return apiSuccess({ id: snap.id, ...data })
}
