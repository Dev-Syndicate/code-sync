import { NextResponse } from 'next/server'

// TODO: Dev 4 — Fetch user repositories from GitHub
export async function GET() {
  return NextResponse.json({ success: true, data: [] })
}
