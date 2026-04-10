import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext } from '@/lib/api/auth'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { saveDraft, loadDraft, type DraftFile } from '@/lib/drafts/DraftStore'

interface DraftRequestBody {
  files: DraftFile[]
}

// ── GET /api/sessions/[id]/drafts ─────────────────────────────────────────────
// Returns every saved draft for this session at once. Used by the Save Revert
// feature so the client can fan draft content back into Y.Text for every open
// file in one go, instead of making one `load-draft?path=…` call per file.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let uid: string
  try {
    const ctx = await getAuthContext(_req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  const { id } = await params
  const sessionSnap = await adminDb.collection('sessions').doc(id).get()
  if (!sessionSnap.exists) return apiError('NOT_FOUND', 'Session not found.', 404)

  const sessionData = sessionSnap.data()!
  const isOwner = sessionData.owner === uid
  const isParticipant = sessionData.participants && uid in sessionData.participants
  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a participant of this session.', 403)
  }

  try {
    const drafts = await loadDraft(id)
    return apiSuccess({ drafts })
  } catch (err) {
    console.error('[GET /api/sessions/[id]/drafts] loadDraft failed:', err)
    return apiError('STORAGE_ERROR', 'Failed to load drafts.', 500)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  let body: DraftRequestBody
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', 400)
  }

  if (!body.files?.length) {
    return apiError('VALIDATION_ERROR', 'files is required and must not be empty.', 400)
  }

  const { id } = await params

  const sessionSnap = await adminDb.collection('sessions').doc(id).get()
  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }

  const sessionData = sessionSnap.data()!

  if (!sessionData.active) {
    return apiError('SESSION_CLOSED', 'This session is no longer active.', 400)
  }

  const isParticipant = sessionData.participants && uid in sessionData.participants
  const isOwner = sessionData.owner === uid
  if (!isParticipant && !isOwner) {
    return apiError('FORBIDDEN', 'You are not a participant of this session.', 403)
  }

  try {
    await saveDraft(id, uid, body.files)
  } catch (err) {
    console.error('[POST /api/sessions/[id]/drafts] saveDraft failed:', err)
    const msg = err instanceof Error ? err.message : 'Failed to save draft.'
    return apiError('STORAGE_ERROR', msg, 500)
  }

  await adminDb.collection('sessions').doc(id).update({
    lastDraftAt: FieldValue.serverTimestamp(),
  })

  return apiSuccess({ savedAt: new Date().toISOString() })
}
