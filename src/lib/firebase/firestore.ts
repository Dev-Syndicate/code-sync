// Dev 1 — Firestore utility helpers
// Generic CRUD helpers, query builders, timestamp converters

import { Timestamp } from 'firebase/firestore'
import type { UserDoc, User } from '@/types'

/**
 * Converts a Firestore Timestamp to a JS Date.
 * Handles null/undefined gracefully.
 */
export function timestampToDate(ts: Timestamp | null | undefined): Date {
  if (!ts) return new Date()
  return ts.toDate()
}

/**
 * Converts a raw Firestore user document snapshot to the app-level User type.
 * The `uid` comes from the document ID, not the document data.
 */
export function toUserFromDoc(uid: string, data: UserDoc): User {
  return {
    uid,
    githubId: data.githubId,
    username: data.username,
    name: data.name,
    avatar: data.avatar,
    email: data.email,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  }
}
