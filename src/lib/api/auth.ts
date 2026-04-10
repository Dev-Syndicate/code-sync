// Server-side auth utilities for API routes
// The session cookie stores the Firebase UID (set by Dev 1's loginWithGitHub)
// We use the Admin SDK to verify the user exists in Firestore and get their data

import { type NextRequest } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export interface AuthContext {
  uid:   string
  email: string | undefined
}

// ── Read the session cookie → return AuthContext or throw ─────────────────────
// Dev 1 sets cookie as: document.cookie = `session=${uid}; ...`
// So the cookie value IS the Firebase UID — we just verify it exists in Firestore
export async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  const sessionCookie = req.cookies.get('session')?.value

  if (!sessionCookie) {
    throw new Error('AUTH_REQUIRED')
  }

  // sessionCookie = Firebase UID (set by Dev 1's auth.ts)
  const uid = decodeURIComponent(sessionCookie)

  // Validate user actually exists in Firestore
  try {
    const userSnap = await adminDb.collection('users').doc(uid).get()
    if (!userSnap.exists) {
      throw new Error('AUTH_EXPIRED')
    }
    const data = userSnap.data()
    return { uid, email: data?.email }
  } catch (err) {
    if (err instanceof Error && err.message === 'AUTH_EXPIRED') throw err
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
