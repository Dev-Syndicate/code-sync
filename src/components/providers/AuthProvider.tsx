// Dev 1 — AuthProvider
// Wraps app with Firebase Auth context listener
'use client'

import { type ReactNode, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { onAuthChange } from '@/lib/firebase/auth'
import { getUser } from '@/lib/firebase/models/user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setLoading, clearUser } = useAuthStore()

  useEffect(() => {
    setLoading(true)

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch full user profile from Firestore
          const user = await getUser(firebaseUser.uid)
          if (user) {
            setUser(user)
            // Ensure session cookie is set (value = UID for Dev 4's getAuthContext)
            const expires = new Date(Date.now() + 7 * 864e5).toUTCString()
            document.cookie = `session=${encodeURIComponent(firebaseUser.uid)}; expires=${expires}; path=/; SameSite=Lax`
          } else {
            // User exists in Firebase Auth but not in Firestore
            // This can happen on first login before the user doc is created
            // The loginWithGitHub flow handles this, so just wait
            clearUser()
          }
        } catch (error) {
          console.error('[AuthProvider] Failed to fetch user:', error)
          clearUser()
        }
      } else {
        clearUser()
        // Clear session cookie
        document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax'
      }
    })

    return () => unsubscribe()
  }, [setUser, setLoading, clearUser])

  return <>{children}</>
}
