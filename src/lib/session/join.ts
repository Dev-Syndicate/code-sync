import type { Session } from '@/types'
import {
  joinSession as joinSessionFirestore,
  getSession,
} from '@/lib/firebase/models/session'

export async function joinSession(
  sessionId: string,
  user: { uid: string; username: string; avatar: string }
): Promise<Session | null> {
  try {
    // Add the user as a participant in Firestore
    await joinSessionFirestore(sessionId, user.uid, {
      username: user.username,
      avatar: user.avatar,
    })

    // Return the updated session data
    const session = await getSession(sessionId)
    return session
  } catch (err) {
    console.error('[joinSession]', err)
    return null
  }
}
