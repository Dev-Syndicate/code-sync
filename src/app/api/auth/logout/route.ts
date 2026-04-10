// POST /api/auth/logout
// Clears the session cookie — call this on sign-out

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.set('session', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,   // Expire immediately
    path:     '/',
  })

  return NextResponse.json({ success: true, data: null }, { status: 200 })
}
