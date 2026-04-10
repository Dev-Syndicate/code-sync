'use client'

import { useEffect } from 'react'
import { useRepoStore } from '@/store/repoStore'
import type { GitHubRepo } from '@/types'

// ────────────────────────────────────────────────
// TODO: REMOVE MOCK — flip to false when Dev 4's /api/repos is ready
const USE_MOCK = true
// ────────────────────────────────────────────────

const MOCK_REPOS: GitHubRepo[] = [
  {
    id: 1,
    name: 'code-sync',
    full_name: 'devuser/code-sync',
    description: 'Real-time collaborative coding platform for students',
    html_url: 'https://github.com/devuser/code-sync',
    language: 'TypeScript',
    private: false,
    default_branch: 'main',
    stargazers_count: 24,
    fork: false,
    updated_at: '2026-04-09T14:00:00Z',
    owner: { login: 'devuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  },
  {
    id: 2,
    name: 'portfolio-website',
    full_name: 'devuser/portfolio-website',
    description: 'Personal portfolio built with Next.js and Tailwind CSS',
    html_url: 'https://github.com/devuser/portfolio-website',
    language: 'TypeScript',
    private: false,
    default_branch: 'main',
    stargazers_count: 8,
    fork: false,
    updated_at: '2026-04-07T09:30:00Z',
    owner: { login: 'devuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  },
  {
    id: 3,
    name: 'algo-visualizer',
    full_name: 'devuser/algo-visualizer',
    description: 'Interactive algorithm visualizer for sorting and graph traversal',
    html_url: 'https://github.com/devuser/algo-visualizer',
    language: 'JavaScript',
    private: false,
    default_branch: 'main',
    stargazers_count: 42,
    fork: false,
    updated_at: '2026-04-01T20:15:00Z',
    owner: { login: 'devuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  },
  {
    id: 4,
    name: 'chat-app',
    full_name: 'devuser/chat-app',
    description: 'Real-time chat application with Firebase backend',
    html_url: 'https://github.com/devuser/chat-app',
    language: 'TypeScript',
    private: true,
    default_branch: 'main',
    stargazers_count: 3,
    fork: false,
    updated_at: '2026-03-28T11:00:00Z',
    owner: { login: 'devuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  },
  {
    id: 5,
    name: 'python-ml-toolkit',
    full_name: 'devuser/python-ml-toolkit',
    description: 'Machine learning utility functions and data preprocessing helpers',
    html_url: 'https://github.com/devuser/python-ml-toolkit',
    language: 'Python',
    private: false,
    default_branch: 'main',
    stargazers_count: 15,
    fork: false,
    updated_at: '2026-03-20T16:45:00Z',
    owner: { login: 'devuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  },
  {
    id: 6,
    name: 'css-component-lib',
    full_name: 'devuser/css-component-lib',
    description: null,
    html_url: 'https://github.com/devuser/css-component-lib',
    language: 'CSS',
    private: false,
    default_branch: 'main',
    stargazers_count: 1,
    fork: true,
    updated_at: '2026-02-15T08:20:00Z',
    owner: { login: 'devuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  },
]

export function useRepos() {
  const {
    filteredRepos,
    loading,
    error,
    searchQuery,
    languageFilter,
    viewMode,
    setRepos,
    setSearchQuery,
    setLanguageFilter,
    setViewMode,
    setLoading,
    setError,
  } = useRepoStore()

  useEffect(() => {
    let cancelled = false

    async function fetchRepos() {
      setLoading(true)
      setError(null)

      try {
        if (USE_MOCK) {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 800))
          if (!cancelled) {
            setRepos(MOCK_REPOS)
          }
        } else {
          // Real API call — uses ApiResponse<GitHubRepo[]> format
          const res = await fetch('/api/repos')
          const json = await res.json()

          if (!cancelled) {
            if (json.success) {
              setRepos(json.data ?? [])
            } else {
              setError(json.error?.message ?? 'Failed to fetch repositories')
            }
          }
        }
      } catch (err) {
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
    loading,
    error,
    searchQuery,
    languageFilter,
    viewMode,
    languages,
    setSearchQuery,
    setLanguageFilter,
    setViewMode,
    refetch: () => {
      setRepos([])
      setLoading(true)
    },
  }
}
