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
  login: () => Promise<void>
  logout: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { user, loading, isAuthenticated } = useAuthStore()
  const addToast = useToastStore((s) => s.addToast)

  const login = async () => {
    try {
      await loginWithGitHub()
      addToast('success', 'Logged in successfully!')
    } catch (error) {
      console.error('[useAuth] login failed:', error)
      addToast('error', 'Login failed. Please try again.')
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
