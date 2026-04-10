// Dev 1 — User model (Firestore data access layer)
// createUser(), getUser(), updateUser(), saveUserToken()

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { toUserFromDoc } from '@/lib/firebase/firestore'
import type { User, UserDoc, CreateUserInput } from '@/types'

/**
 * Creates a new user document in Firestore.
 * Called after successful GitHub OAuth login.
 */
export async function createUser(
  uid: string,
  input: CreateUserInput
): Promise<User> {
  const userRef = doc(db, 'users', uid)
  const now = serverTimestamp()

  const userData: Omit<UserDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>
    updatedAt: ReturnType<typeof serverTimestamp>
  } = {
    ...input,
    createdAt: now,
    updatedAt: now,
  }

  await setDoc(userRef, userData)

  // Return a User object with Date (approximate — serverTimestamp resolves on server)
  return {
    uid,
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Fetches a user by UID from Firestore.
 * Returns null if user doesn't exist.
 */
export async function getUser(uid: string): Promise<User | null> {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)

  if (!snap.exists()) return null

  return toUserFromDoc(uid, snap.data() as UserDoc)
}

/**
 * Partially updates a user document.
 * Always sets updatedAt to serverTimestamp.
 */
export async function updateUser(
  uid: string,
  fields: Partial<Omit<UserDoc, 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, {
    ...fields,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Stores the GitHub access token in the server-only subcollection.
 * Path: /users/{uid}/private/tokens
 *
 * ⚠️ This subcollection is locked by Firestore rules — only Firebase Admin
 * can read it. Client writes are allowed here because the user owns the doc,
 * but reads from the client are blocked.
 *
 * Note: With the current open dev rules (expire 2026-05-10), client writes
 * work. In production, this should use Firebase Admin SDK from API routes.
 */
export async function saveUserToken(
  uid: string,
  accessToken: string
): Promise<void> {
  const tokenRef = doc(db, 'users', uid, 'private', 'tokens')
  await setDoc(tokenRef, { accessToken })
}
