// POST /api/auth/session
// Called by Dev 1 after Firebase signInWithPopup succeeds.
// Body: { idToken: string, accessToken: string }
//
// 1. Verifies the Firebase ID token via Admin SDK
// 2. Stores the GitHub accessToken in /users/{uid}/private/tokens
// 3. Sets an HTTP-only session cookie for middleware.ts to read

import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { apiError } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'

interface SessionRequestBody {
  idToken:     string
  accessToken: string
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
  } catch {
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
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed to store access token.', 500)
  }

  // 3. Set HTTP-only session cookie  (stores the raw Firebase ID token)
  //    middleware.ts reads this to protect routes
  const cookieStore = await cookies()
  cookieStore.set('session', idToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,   // 7 days
    path:     '/',
  })

  return NextResponse.json({ success: true, data: { uid } }, { status: 200 })
}
