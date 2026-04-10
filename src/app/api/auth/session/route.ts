// POST /api/auth/session
// Called by loginWithGitHub() after Firebase signInWithPopup succeeds.
// Body: { idToken: string, accessToken: string }
//
// 1. Verifies the Firebase ID token via Admin SDK
// 2. Stores the GitHub accessToken in /users/{uid}/private/tokens
// 3. Mints a long-lived session cookie via adminAuth.createSessionCookie
//    and sets it as the HTTP-only `session` cookie that proxy.ts reads.

import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { apiError } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'

interface SessionRequestBody {
  idToken:     string
  accessToken: string
}

// 7 days — the maximum Firebase allows for session cookies is 14 days.
const SESSION_COOKIE_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000

// GET /api/auth/session
// Real session probe used by syncServerSession() on the client. Returns 200
// if the `session` cookie is present and verifies against Firebase Admin,
// 401 otherwise. Do NOT turn this into a stub again — the login page's
// redirect decision depends on it returning 401 for unauthenticated users
// and 200 for authenticated ones without side effects on other routes.
export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get('session')?.value
  if (!sessionCookie) {
    return apiError('AUTH_REQUIRED', 'No session cookie.', 401)
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    return NextResponse.json(
      { success: true, data: { uid: decoded.uid } },
      { status: 200 }
    )
  } catch (err) {
    console.error('[GET /api/auth/session] verify failed:', err)
    return apiError('AUTH_EXPIRED', 'Session expired or invalid.', 401)
  }
}

export async function POST(req: NextRequest) {
  let body: SessionRequestBody

  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', 400)
  }

  const { idToken, accessToken } = body

  if (!idToken || !accessToken) {
    return apiError('VALIDATION_ERROR', 'idToken and accessToken are required.', 400)
  }

  // 1. Verify the Firebase ID token
  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    uid = decoded.uid
  } catch (err) {
    console.error('[POST /api/auth/session] verifyIdToken failed:', err)
    return apiError('AUTH_EXPIRED', 'Invalid or expired ID token.', 401)
  }

  // 2. Store GitHub access token in the server-only subcollection
  try {
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('private')
      .doc('tokens')
      .set({ accessToken, updatedAt: FieldValue.serverTimestamp() })
  } catch (err) {
    console.error('[POST /api/auth/session] token write failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to store access token.', 500)
  }

  // 3. Mint a real session cookie and set it HTTP-only.
  let sessionCookie: string
  try {
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_COOKIE_MAX_AGE_MS,
    })
  } catch (err) {
    console.error('[POST /api/auth/session] createSessionCookie failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to create session cookie.', 500)
  }

  const cookieStore = await cookies()
  cookieStore.set('session', sessionCookie, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   SESSION_COOKIE_MAX_AGE_MS / 1000,
    path:     '/',
  })

  return NextResponse.json({ success: true, data: { uid } }, { status: 200 })
}
