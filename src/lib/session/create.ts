import type { CreateSessionInput, Session } from '@/types'

export async function createSession(
  input: CreateSessionInput
): Promise<Session | null> {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    const json = await res.json()

    if (json.success) {
      return json.data as Session
    } else {
      // Handle auth errors
      if (json.error?.code === 'AUTH_EXPIRED' || json.error?.code === 'AUTH_REQUIRED') {
        window.location.href = '/login'
        return null
      }
      console.error('[createSession]', json.error?.message)
      return null
    }
  } catch (err) {
    console.error('[createSession] Network error:', err)
    return null
  }
}
