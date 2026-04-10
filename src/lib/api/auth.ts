// Server-side auth utilities for API routes
// Verifies the Firebase session cookie (minted by POST /api/auth/session)
// and returns the authenticated Firebase UID.

import { type NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export interface AuthContext {
  uid:   string
  email: string | undefined
}

// ── Verify session cookie → returns AuthContext or throws ─────────────────────
export async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  const sessionCookie = req.cookies.get('session')?.value

  if (!sessionCookie) {
    throw new Error('AUTH_REQUIRED')
  }

  try {
    // checkRevoked=true hits Firebase Auth to ensure the user hasn't been
    // disabled or had their refresh tokens revoked. Worth the ~50ms.
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    return { uid: decoded.uid, email: decoded.email }
  } catch (err) {
    console.error('[getAuthContext] verifySessionCookie failed:', err)
    throw new Error('AUTH_EXPIRED')
  }
}

// ── Retrieve GitHub access token for a user (server-only subcollection) ───────
export async function getGitHubToken(uid: string): Promise<string> {
  const tokenDoc = await adminDb
    .collection('users')
    .doc(uid)
    .collection('private')
    .doc('tokens')
    .get()

  if (!tokenDoc.exists) {
    throw new Error('GITHUB_ERROR')
  }

  const token = tokenDoc.data()?.accessToken as string | undefined

  if (!token) {
    throw new Error('GITHUB_ERROR')
  }

  return token
}
