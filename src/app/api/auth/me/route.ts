// GET /api/auth/me
// Returns the currently authenticated user, resolved from the HTTP-only
// `session` cookie (the same cookie proxy.ts gates protected routes on).
//
// Used by AuthProvider on the client to hydrate the auth store when Firebase
// client auth hasn't restored a user yet but the server session cookie is
// still valid (e.g. after a hard refresh, or when IndexedDB was cleared but
// the cookie survived). The server session cookie is the authoritative
// source of truth for "is this user logged in".

import { type NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { apiError, apiSuccess } from '@/lib/api/response'
import type { User } from '@/types'

// The admin SDK returns its own Timestamp class (distinct from the client
// SDK's Timestamp that UserDoc is typed against), but both expose .toDate().
interface HasToDate {
  toDate(): Date
}

function toDate(ts: unknown): Date {
  if (ts && typeof (ts as HasToDate).toDate === 'function') {
    return (ts as HasToDate).toDate()
  }
  return new Date()
}

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get('session')?.value

  if (!sessionCookie) {
    return apiError('AUTH_REQUIRED', 'Not authenticated.', 401)
  }

  let uid: string
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    uid = decoded.uid
  } catch (err) {
    console.error('[GET /api/auth/me] verifySessionCookie failed:', err)
    return apiError('AUTH_EXPIRED', 'Session expired or invalid.', 401)
  }

  let snap
  try {
    snap = await adminDb.collection('users').doc(uid).get()
  } catch (err) {
    console.error('[GET /api/auth/me] firestore read failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to load user profile.', 500)
  }

  if (!snap.exists) {
    return apiError('NOT_FOUND', 'User profile not found.', 404)
  }

  const data = snap.data() as {
    githubId: string
    username: string
    name: string
    avatar: string
    email: string
    createdAt: unknown
    updatedAt: unknown
  }

  const user: User = {
    uid,
    githubId: data.githubId,
    username: data.username,
    name: data.name,
    avatar: data.avatar,
    email: data.email,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }

  return apiSuccess(user)
}
