// Server-side helper: ensure a Firestore /users/{uid} document exists for
// the authenticated user, creating it from the Firebase Auth UserRecord if
// it's missing.
//
// Why this exists:
//
// The normal login flow in src/lib/firebase/auth.ts writes the user doc from
// the client *before* calling POST /api/auth/session, so every fresh login
// produces a matching Firestore user doc. But several edge cases can break
// that invariant:
//
// - Legacy accounts from before the user model was wired up.
// - A failed client-side Firestore write during login (auth succeeds, doc
//   write throws silently, user ends up in a half-provisioned state).
// - A user doc deleted manually in the Firebase console.
//
// Any protected API route that wants to display the user's username/avatar
// (e.g. /api/sessions/[id]/join building the participant entry) used to 404
// in those cases. This helper makes routes self-healing: if the doc isn't
// there, we reconstruct it from the trusted Firebase Auth record and write
// it back. The session cookie has already been verified by the caller, so
// the uid is trusted.

import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export interface EnsuredUser {
  uid: string
  username: string
  name: string
  avatar: string
  email: string
  githubId: string
}

/**
 * Returns the /users/{uid} document, creating it first if it doesn't exist.
 *
 * The caller must have already verified the uid via getAuthContext (i.e.
 * the session cookie is valid). This function trusts the uid.
 */
export async function ensureUserDoc(uid: string): Promise<EnsuredUser> {
  const userRef = adminDb.collection('users').doc(uid)
  const snap = await userRef.get()

  if (snap.exists) {
    const data = snap.data() ?? {}
    return {
      uid,
      username: (data.username as string) ?? '',
      name: (data.name as string) ?? '',
      avatar: (data.avatar as string) ?? '',
      email: (data.email as string) ?? '',
      githubId: (data.githubId as string) ?? '',
    }
  }

  // User doc is missing — rebuild from the Firebase Auth UserRecord. The
  // GitHub provider entry sits in providerData; for a GitHub-only login it's
  // providerData[0], but we search by providerId to be safe in case other
  // providers are linked in the future.
  const authUser = await adminAuth.getUser(uid)
  const githubProvider = authUser.providerData.find(
    (p) => p.providerId === 'github.com'
  )

  // displayName on the GitHub provider entry is the GitHub `login` (handle);
  // the top-level UserRecord.displayName is usually the human name. Fall
  // back through a chain so we always end up with *something* visible.
  const username =
    githubProvider?.displayName ??
    authUser.displayName ??
    authUser.email?.split('@')[0] ??
    `user-${uid.slice(0, 6)}`

  const name = authUser.displayName ?? username
  const avatar = githubProvider?.photoURL ?? authUser.photoURL ?? ''
  const email = githubProvider?.email ?? authUser.email ?? ''
  const githubId = githubProvider?.uid ?? ''

  await userRef.set({
    githubId,
    username,
    name,
    avatar,
    email,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  console.log(
    `[ensureUserDoc] backfilled missing user doc for ${uid} (username=${username})`
  )

  return { uid, username, name, avatar, email, githubId }
}
