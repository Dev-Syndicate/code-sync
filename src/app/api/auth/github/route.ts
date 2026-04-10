// NOTE: GitHub OAuth is handled by Firebase Auth (signInWithPopup on the client).
// The old custom OAuth flow is no longer needed.
// After sign-in, Dev 1 calls POST /api/auth/session to bridge to server-side auth.

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { message: 'Use Firebase GitHub OAuth on the client, then POST to /api/auth/session.' },
    { status: 200 }
  )
}
