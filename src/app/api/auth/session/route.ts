// POST /api/auth/session
// Note: Dev 1 handles auth directly via Firebase signInWithPopup + client-side cookie.
// This endpoint is kept as a server-side utility if needed but is NOT the primary flow.
//
// Dev 1's loginWithGitHub() in lib/firebase/auth.ts:
//   1. Signs in with Firebase GitHub OAuth
//   2. Saves GitHub token to Firestore /users/{uid}/private/tokens
//   3. Sets cookie: document.cookie = `session=${uid}; ...`
//
// Our API routes read this UID-based cookie via getAuthContext() in lib/api/auth.ts

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { message: 'Auth is handled by Firebase GitHub OAuth on the client (Dev 1).' },
    { status: 200 }
  )
}
