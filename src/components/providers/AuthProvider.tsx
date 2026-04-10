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
      }
    })

    return () => unsubscribe()
  }, [setUser, setLoading, clearUser])

  return <>{children}</>
}
