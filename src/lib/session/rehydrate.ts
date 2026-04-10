// Rehydrate Firestore Timestamps after they cross the JSON wire.
//
// The Admin SDK returns `Timestamp` instances server-side, but when Next's
// API route serializes them with JSON.stringify they turn into plain
// `{ _seconds, _nanoseconds }` objects (or sometimes `{ seconds, nanoseconds }`
// depending on the SDK path). Client components expect the Firestore
// `Timestamp` class shape — specifically `.toDate()` and `.toMillis()` — so
// calling those methods on the wire shape returns undefined and every
// downstream `if (!created) return` silently drops the session.
//
// This helper walks a Session object and rehydrates every timestamp field
// into a real `Timestamp` instance. Apply it at the fetch boundary in the
// dashboard and sidebar so every analytics component "just works" without
// changing.

import { Timestamp } from 'firebase/firestore'
import type { Session } from '@/types'

type WireTimestamp =
  | Timestamp
  | { _seconds: number; _nanoseconds: number }
  | { seconds: number; nanoseconds: number }
  | null
  | undefined

function rehydrateTimestamp(ts: WireTimestamp): Timestamp | null {
  if (!ts) return null
  if (ts instanceof Timestamp) return ts
  if (typeof (ts as Timestamp).toDate === 'function') return ts as Timestamp
  const seconds =
    '_seconds' in ts
      ? ts._seconds
      : 'seconds' in ts
        ? ts.seconds
        : undefined
  const nanoseconds =
    '_nanoseconds' in ts
      ? ts._nanoseconds
      : 'nanoseconds' in ts
        ? ts.nanoseconds
        : 0
  if (typeof seconds !== 'number') return null
  return new Timestamp(seconds, nanoseconds ?? 0)
}

export function rehydrateSession(session: Session): Session {
  const participants = session.participants
    ? Object.fromEntries(
        Object.entries(session.participants).map(([uid, p]) => [
          uid,
          {
            ...p,
            joinedAt:
              rehydrateTimestamp(p.joinedAt as unknown as WireTimestamp) ??
              p.joinedAt,
          },
        ])
      )
    : session.participants

  return {
    ...session,
    participants,
    createdAt:
      rehydrateTimestamp(session.createdAt as unknown as WireTimestamp) ??
      session.createdAt,
    closedAt: rehydrateTimestamp(session.closedAt as unknown as WireTimestamp),
    lastDraftAt: rehydrateTimestamp(
      session.lastDraftAt as unknown as WireTimestamp
    ),
  }
}

export function rehydrateSessions(sessions: Session[]): Session[] {
  return sessions.map(rehydrateSession)
}
