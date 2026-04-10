import { NextResponse } from 'next/server'

// TODO: Dev 4 — Create / get sessions
export async function GET() {
  return NextResponse.json({ success: true, data: [] })
}

export async function POST() {
  return NextResponse.json({ success: true, data: null })
}
