import type { CreateSessionInput, Session } from '@/types'
import { Timestamp } from 'firebase/firestore'

// ────────────────────────────────────────────────
// TODO: REMOVE MOCK — flip to false when Dev 4's /api/sessions is ready
const USE_MOCK = true
// ────────────────────────────────────────────────

export async function createSession(
  input: CreateSessionInput
): Promise<Session | null> {
  try {
    if (USE_MOCK) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 600))

      // Generate a mock session
      const mockSession: Session = {
        id: crypto.randomUUID(),
        repo: input.repo,
        repoOwner: input.repoOwner,
        repoUrl: input.repoUrl,
        branch: input.branch,
        owner: input.owner,
        participants: {
          [input.owner]: {
            username: 'devuser',
            avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
            color: '#3b82f6',
            joinedAt: Timestamp.now(),
          },
        },
        files: input.files,
        active: true,
        maxParticipants: input.maxParticipants ?? 4,
        createdAt: Timestamp.now(),
        closedAt: null,
        lastDraftAt: null,
      }

      return mockSession
    }

    // Real API call — POST to /api/sessions
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    const json = await res.json()

    if (json.success) {
      return json.data as Session
    } else {
      console.error('[createSession]', json.error?.message)
      return null
    }
  } catch (err) {
    console.error('[createSession] Network error:', err)
    return null
  }
}
