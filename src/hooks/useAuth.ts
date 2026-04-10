// TODO: Dev 1 — Auth hook (contract for Dev 2, 3, 4)
// This is the integration contract — do NOT change the return shape without team discussion

import type { User } from '@/types'

export function useAuth() {
  // TODO: implement with Firebase Auth
  return {
    user: null as User | null,
    loading: true,
    isAuthenticated: false,
    login: async () => {},
    logout: async () => {},
  }
}
