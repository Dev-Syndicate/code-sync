'use client'

import { useEffect } from 'react'
import { useRepoStore } from '@/store/repoStore'

export function useRepos() {
  const {
    filteredRepos,
    loading,
    error,
    searchQuery,
    languageFilter,
    viewMode,
    sortBy,
    visibilityFilter,
    hideForks,
    pinnedRepoIds,
    setRepos,
    setSearchQuery,
    setLanguageFilter,
    setViewMode,
    setSortBy,
    setVisibilityFilter,
    setHideForks,
    togglePinned,
    setLoading,
    setError,
  } = useRepoStore()

  useEffect(() => {
    let cancelled = false

    async function fetchRepos() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/repos')
        const json = await res.json()

        if (!cancelled) {
          if (json.success) {
            setRepos(json.data ?? [])
          } else {
            // Handle specific error codes
            if (json.error?.code === 'AUTH_EXPIRED' || json.error?.code === 'AUTH_REQUIRED') {
              await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
              window.location.replace('/login')
              return
            }
            setError(json.error?.message ?? 'Failed to fetch repositories')
          }
        }
      } catch {
        if (!cancelled) {
          setError('Network error. Please check your connection.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchRepos()

    return () => {
      cancelled = true
    }
  }, [setRepos, setLoading, setError])

  // Extract unique languages for the filter dropdown
  const allRepos = useRepoStore((s) => s.repos)
  const languages = Array.from(
    new Set(allRepos.map((r) => r.language).filter(Boolean) as string[])
  ).sort()

  return {
    repos: filteredRepos,
    allRepos,
    loading,
    error,
    searchQuery,
    languageFilter,
    viewMode,
    sortBy,
    visibilityFilter,
    hideForks,
    pinnedRepoIds,
    languages,
    setSearchQuery,
    setLanguageFilter,
    setViewMode,
    setSortBy,
    setVisibilityFilter,
    setHideForks,
    togglePinned,
    refetch: () => {
      setRepos([])
      setLoading(true)
    },
  }
}
