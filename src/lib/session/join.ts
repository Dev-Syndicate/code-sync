import type { Session } from '@/types'
import { Timestamp } from 'firebase/firestore'

// ────────────────────────────────────────────────
// TODO: REMOVE MOCK — flip to false when Dev 4's /api/sessions is ready
const USE_MOCK = true
// ────────────────────────────────────────────────

export async function joinSession(
  sessionId: string,
  user: { uid: string; username: string; avatar: string }
): Promise<Session | null> {
  try {
    if (USE_MOCK) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 400))

      // Return a mock session with the user added
      const mockSession: Session = {
        id: sessionId,
        repo: 'code-sync',
        repoOwner: 'devuser',
        repoUrl: 'https://github.com/devuser/code-sync',
        branch: 'main',
        owner: 'owner-uid-123',
        participants: {
          'owner-uid-123': {
            username: 'sessionowner',
            avatar: 'https://avatars.githubusercontent.com/u/2?v=4',
            color: '#ef4444',
            joinedAt: Timestamp.now(),
          },
          [user.uid]: {
            username: user.username,
            avatar: user.avatar,
            color: '#3b82f6',
            joinedAt: Timestamp.now(),
          },
        },
        files: [
          { path: 'src/index.ts', language: 'typescript', sha: 'abc123' },
          { path: 'src/app.tsx', language: 'typescriptreact', sha: 'def456' },
        ],
        active: true,
        maxParticipants: 4,
        createdAt: Timestamp.now(),
        closedAt: null,
        lastDraftAt: null,
      }

      return mockSession
    }

    // Real API call — POST to /api/sessions/{id}/join
    const res = await fetch(`/api/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.uid }),
    })

    const json = await res.json()

    if (json.success) {
      return json.data as Session
    } else {
      console.error('[joinSession]', json.error?.message)
      return null
    }
  } catch (err) {
    console.error('[joinSession] Network error:', err)
    return null
  }
}
