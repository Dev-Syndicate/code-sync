// Dev 1 — Auth hook (contract for Dev 2, 3, 4)
// This is the integration contract — do NOT change the return shape without team discussion

'use client'

import { useAuthStore } from '@/store/authStore'
import { loginWithGitHub, logoutUser } from '@/lib/firebase/auth'
import { useToastStore } from '@/store/toastStore'
import type { User } from '@/types'

interface UseAuthReturn {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: () => Promise<boolean>
  logout: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { user, loading, isAuthenticated } = useAuthStore()
  const addToast = useToastStore((s) => s.addToast)

  const login = async (): Promise<boolean> => {
    try {
      await loginWithGitHub()
      addToast('success', 'Logged in successfully!')
      return true
    } catch (error) {
      // Log the full error — we were previously swallowing it, which made
      // silent login failures almost impossible to diagnose.
      console.error('[useAuth] login failed:', error)
      const message =
        error instanceof Error ? error.message : 'Login failed. Please try again.'
      addToast('error', message)
      return false
    }
  }

  const logout = async () => {
    try {
      await logoutUser()
      addToast('info', 'Logged out.')
    } catch (error) {
      console.error('[useAuth] logout failed:', error)
      addToast('error', 'Logout failed. Please try again.')
    }
  }

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
  }
}
