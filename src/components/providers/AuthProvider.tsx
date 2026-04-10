// Dev 1 — AuthProvider
// Wraps app with Firebase Auth context listener
'use client'

import { type ReactNode, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { onAuthChange } from '@/lib/firebase/auth'
import { getUser } from '@/lib/firebase/models/user'
import type { User } from '@/types'

// Hydrate from the server session cookie. This is the authoritative source
// of truth for "is this user logged in" (proxy.ts gates protected routes
// on the same cookie). We fall back to this whenever Firebase client auth
// reports no user — typically after a hard refresh before IndexedDB has
// rehydrated, or when client persistence was cleared but the cookie survived.
async function hydrateFromServerSession(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.success || !json.data) return null
    // createdAt/updatedAt come back as ISO strings over JSON — revive them.
    const raw = json.data as Omit<User, 'createdAt' | 'updatedAt'> & {
      createdAt: string
      updatedAt: string
    }
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
    }
  } catch (err) {
    console.error('[AuthProvider] /api/auth/me failed:', err)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setLoading, clearUser } = useAuthStore()

  useEffect(() => {
    setLoading(true)
    let cancelled = false

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch full user profile from Firestore
          const user = await getUser(firebaseUser.uid)
          if (cancelled) return
          if (user) {
            setUser(user)
          } else {
            // User exists in Firebase Auth but not in Firestore
            // This can happen on first login before the user doc is created
            // The loginWithGitHub flow handles this, so just wait
            clearUser()
          }
        } catch (error) {
          console.error('[AuthProvider] Failed to fetch user:', error)
          if (!cancelled) clearUser()
        }
      } else {
        // Firebase client auth has no user — but the server session cookie
        // may still be valid (e.g. hard refresh before client persistence
        // rehydrates). Ask the server before clearing the store, otherwise
        // the dashboard header flashes a blank avatar for authenticated users.
        const serverUser = await hydrateFromServerSession()
        if (cancelled) return
        if (serverUser) {
          setUser(serverUser)
        } else {
          clearUser()
        }
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setUser, setLoading, clearUser])

  return <>{children}</>
}
