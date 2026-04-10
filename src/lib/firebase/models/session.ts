// Dev 1 — Session model (Firestore data access layer)
// createSession(), getSession(), joinSession(), closeSession()

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type {
  Session,
  SessionDoc,
  CreateSessionInput,
  Participant,
} from '@/types'

/**
 * Creates a new session document in Firestore.
 * Auto-generates a unique document ID.
 */
export async function createSession(
  input: CreateSessionInput
): Promise<Session> {
  const sessionRef = doc(collection(db, 'sessions'))
  const now = serverTimestamp()

  const sessionData = {
    repo: input.repo,
    repoOwner: input.repoOwner,
    repoUrl: input.repoUrl,
    branch: input.branch,
    owner: input.owner,
    participants: {},
    files: input.files,
    active: true,
    maxParticipants: input.maxParticipants ?? 4,
    createdAt: now,
    closedAt: null,
    lastDraftAt: null,
  }

  await setDoc(sessionRef, sessionData)

  return {
    id: sessionRef.id,
    ...sessionData,
    createdAt: now,
    closedAt: null,
    lastDraftAt: null,
  } as unknown as Session
}

/**
 * Fetches a session by ID from Firestore.
 * Returns null if session doesn't exist.
 */
export async function getSession(
  sessionId: string
): Promise<Session | null> {
  const sessionRef = doc(db, 'sessions', sessionId)
  const snap = await getDoc(sessionRef)

  if (!snap.exists()) return null

  return {
    id: snap.id,
    ...snap.data(),
  } as Session
}

/**
 * Adds a participant to an existing session.
 * Assigns a unique cursor color based on participant count.
 */
export async function joinSession(
  sessionId: string,
  userId: string,
  participant: Omit<Participant, 'color' | 'joinedAt'>
): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId)
  const snap = await getDoc(sessionRef)

  if (!snap.exists()) {
    throw new Error('Session not found')
  }

  const data = snap.data() as SessionDoc

  // Check if session is active
  if (!data.active) {
    throw new Error('Session is closed')
  }

  // Check participant limit
  const currentCount = Object.keys(data.participants).length
  if (currentCount >= data.maxParticipants) {
    throw new Error('Session is full')
  }

  // Assign a cursor color — cycle through CURSOR_COLORS
  const { CURSOR_COLORS: colors } = await import('@/types')
  const colorIndex = currentCount % colors.length
  const color = colors[colorIndex]

  await updateDoc(sessionRef, {
    [`participants.${userId}`]: {
      ...participant,
      color,
      joinedAt: serverTimestamp(),
    },
  })
}

/**
 * Closes a session. Only the session owner should call this.
 */
export async function closeSession(sessionId: string): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId)
  await updateDoc(sessionRef, {
    active: false,
    closedAt: serverTimestamp(),
  })
}
