// Dev 1 — Presence model (Firestore data access layer)
// setPresence(), onPresenceChange(), removePresence()

import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { PresenceDoc, Presence, CursorColor } from '@/types'

/**
 * Sets (creates or updates) a user's presence in a session.
 */
export async function setPresence(
  sessionId: string,
  userId: string,
  data: {
    username: string
    avatar: string
    color: CursorColor
    cursorFile?: string
    cursorLine?: number
    cursorColumn?: number
  }
): Promise<void> {
  const presenceRef = doc(db, 'presence', sessionId, userId)
  await setDoc(
    presenceRef,
    {
      online: true,
      username: data.username,
      avatar: data.avatar,
      color: data.color,
      cursorFile: data.cursorFile ?? '',
      cursorLine: data.cursorLine ?? 0,
      cursorColumn: data.cursorColumn ?? 0,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  )
}

/**
 * Subscribes to real-time presence changes for all users in a session.
 * Returns an unsubscribe function.
 */
export function onPresenceChange(
  sessionId: string,
  callback: (presences: Presence[]) => void
): () => void {
  const presenceCol = collection(db, 'presence', sessionId)

  return onSnapshot(presenceCol, (snapshot) => {
    const presences: Presence[] = snapshot.docs.map((docSnap) => ({
      userId: docSnap.id,
      ...(docSnap.data() as PresenceDoc),
    }))
    callback(presences)
  })
}

/**
 * Removes a user's presence document from a session.
 */
export async function removePresence(
  sessionId: string,
  userId: string
): Promise<void> {
  const presenceRef = doc(db, 'presence', sessionId, userId)
  await deleteDoc(presenceRef)
}
