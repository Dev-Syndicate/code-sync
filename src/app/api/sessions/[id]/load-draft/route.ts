import { type NextRequest } from 'next/server'
import { loadDraft } from '@/lib/drafts/DraftStore'
import { adminDb } from '@/lib/firebase/admin'
import { getAuthContext } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: string
  try {
    const ctx = await getAuthContext(request)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  const { id: sessionId } = await params

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) return apiError('VALIDATION_ERROR', 'Missing required query param: path.', 400)

  const sessionDoc = await adminDb.collection('sessions').doc(sessionId).get()
  if (!sessionDoc.exists) return apiError('NOT_FOUND', 'Session not found.', 404)

  const sessionData = sessionDoc.data()!
  const isOwner = sessionData.owner === uid
  const isParticipant = sessionData.participants && uid in sessionData.participants

  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a participant of this session.', 403)
  }

  const drafts = await loadDraft(sessionId)
  const fileDraft = drafts.find((d) => d.path === path) ?? null

  if (!fileDraft) {
    return apiSuccess({ draft: null })
  }

  return apiSuccess({
    draft: {
      content:     fileDraft.content,
      originalSha: fileDraft.originalSha,
      uploadedBy:  fileDraft.uploadedBy,
      uploadedAt:  fileDraft.uploadedAt,
    },
  })
}
