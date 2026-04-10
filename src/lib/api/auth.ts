// Server-side auth utilities for API routes
// Verifies the session cookie and returns the Firebase UID

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
    const decoded = await adminAuth.verifyIdToken(sessionCookie)
    return { uid: decoded.uid, email: decoded.email }
  } catch {
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
