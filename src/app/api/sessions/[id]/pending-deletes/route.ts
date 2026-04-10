// GET /api/sessions/[id]/pending-deletes
// PUT /api/sessions/[id]/pending-deletes
//
// Per-session "pending deletes" list. These are paths the user removed
// from the Explorer (or renamed away from) that existed on GitHub — on
// the next commit, they become `sha: null` Git Tree entries, removing
// the paths from the repo.
//
// We store this as a tiny JSON object in Firebase Storage under the same
// session prefix as drafts:
//   drafts/{sessionId}/__pending_deletes__.json
//
// Rationale: reusing the drafts bucket keeps session cleanup simple
// (deleteSessionDrafts already blows away everything under that prefix
// on session close). It's also not worth a separate Firestore doc for
// a typical payload of a few dozen strings.

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext } from '@/lib/api/auth'
import { adminDb, adminStorage } from '@/lib/firebase/admin'

const PENDING_DELETES_FILENAME = '__pending_deletes__.json'

interface StoredPendingDeletes {
  deletes: string[]
  updatedAt: string
  updatedBy: string
}

function pendingDeletesPath(sessionId: string): string {
  return `drafts/${sessionId}/${PENDING_DELETES_FILENAME}`
}

async function assertSessionMembership(
  uid: string,
  sessionId: string
): Promise<Response | null> {
  const snap = await adminDb.collection('sessions').doc(sessionId).get()
  if (!snap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }
  const data = snap.data()!
  const isOwner = data.owner === uid
  const isParticipant = data.participants && uid in data.participants
  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a member of this session.', 403)
  }
  return null
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  const { id: sessionId } = await params
  const membershipErr = await assertSessionMembership(uid, sessionId)
  if (membershipErr) return membershipErr

  try {
    const bucket = adminStorage.bucket(
      process.env.FIREBASE_ADMIN_STORAGE_BUCKET
    )
    const file = bucket.file(pendingDeletesPath(sessionId))
    const [exists] = await file.exists()
    if (!exists) {
      return apiSuccess({ deletes: [] as string[] })
    }
    const [buf] = await file.download()
    const parsed = JSON.parse(buf.toString('utf-8')) as StoredPendingDeletes
    const deletes = Array.isArray(parsed.deletes)
      ? parsed.deletes.filter((p): p is string => typeof p === 'string')
      : []
    return apiSuccess({ deletes })
  } catch (err) {
    console.error(
      '[GET /api/sessions/[id]/pending-deletes] read failed:',
      err
    )
    return apiError(
      'STORAGE_ERROR',
      'Failed to load pending deletes.',
      500
    )
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────
// Replaces the list wholesale. Clients send the full desired state on
// every update; we don't do partial patches because the list is tiny.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch {
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  const { id: sessionId } = await params
  const membershipErr = await assertSessionMembership(uid, sessionId)
  if (membershipErr) return membershipErr

  let body: { deletes?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body.', 400)
  }

  const raw = body.deletes
  if (!Array.isArray(raw)) {
    return apiError('VALIDATION_ERROR', 'deletes must be an array.', 400)
  }
  for (const p of raw) {
    if (
      typeof p !== 'string' ||
      !p.trim() ||
      p.includes('..') ||
      p.startsWith('/')
    ) {
      return apiError('VALIDATION_ERROR', 'Invalid delete path.', 400)
    }
  }

  const stored: StoredPendingDeletes = {
    deletes: raw as string[],
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  }

  try {
    const bucket = adminStorage.bucket(
      process.env.FIREBASE_ADMIN_STORAGE_BUCKET
    )
    await bucket
      .file(pendingDeletesPath(sessionId))
      .save(JSON.stringify(stored), {
        contentType: 'application/json',
      })
  } catch (err) {
    console.error(
      '[PUT /api/sessions/[id]/pending-deletes] write failed:',
      err
    )
    return apiError(
      'STORAGE_ERROR',
      'Failed to save pending deletes.',
      500
    )
  }

  return apiSuccess({ ok: true })
}
