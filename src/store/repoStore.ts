import { create } from 'zustand'
import type { GitHubRepo } from '@/types'

interface RepoStore {
  repos: GitHubRepo[]
  filteredRepos: GitHubRepo[]
  loading: boolean
  error: string | null
  searchQuery: string
  languageFilter: string | null
  viewMode: 'grid' | 'list'

  // Actions
  setRepos: (repos: GitHubRepo[]) => void
  setSearchQuery: (query: string) => void
  setLanguageFilter: (lang: string | null) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

function applyFilters(
  repos: GitHubRepo[],
  searchQuery: string,
  languageFilter: string | null
): GitHubRepo[] {
  let result = repos

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    result = result.filter(
      (repo) =>
        repo.name.toLowerCase().includes(q) ||
        repo.full_name.toLowerCase().includes(q) ||
        (repo.description?.toLowerCase().includes(q) ?? false)
    )
  }

  if (languageFilter) {
    result = result.filter(
      (repo) => repo.language?.toLowerCase() === languageFilter.toLowerCase()
    )
  }

  return result
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  repos: [],
  filteredRepos: [],
  loading: false,
  error: null,
  searchQuery: '',
  languageFilter: null,
  viewMode: 'grid',

  setRepos: (repos) => {
    const { searchQuery, languageFilter } = get()
    set({
      repos,
      filteredRepos: applyFilters(repos, searchQuery, languageFilter),
    })
  },

  setSearchQuery: (searchQuery) => {
    const { repos, languageFilter } = get()
    set({
      searchQuery,
      filteredRepos: applyFilters(repos, searchQuery, languageFilter),
    })
  },

  setLanguageFilter: (languageFilter) => {
    const { repos, searchQuery } = get()
    set({
      languageFilter,
      filteredRepos: applyFilters(repos, searchQuery, languageFilter),
    })
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
