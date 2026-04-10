import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { GitHubRepo } from '@/types'

export type SortBy = 'recent' | 'stars' | 'name'
export type VisibilityFilter = 'all' | 'public' | 'private'

interface RepoStore {
  repos: GitHubRepo[]
  filteredRepos: GitHubRepo[]
  loading: boolean
  error: string | null
  searchQuery: string
  languageFilter: string | null
  viewMode: 'grid' | 'list'

  // New filter/sort state (persisted)
  sortBy: SortBy
  visibilityFilter: VisibilityFilter
  hideForks: boolean
  pinnedRepoIds: number[]

  // Actions
  setRepos: (repos: GitHubRepo[]) => void
  setSearchQuery: (query: string) => void
  setLanguageFilter: (lang: string | null) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSortBy: (sort: SortBy) => void
  setVisibilityFilter: (v: VisibilityFilter) => void
  setHideForks: (hide: boolean) => void
  togglePinned: (id: number) => void
  isPinned: (id: number) => boolean
}

function applyFiltersAndSort(
  repos: GitHubRepo[],
  searchQuery: string,
  languageFilter: string | null,
  sortBy: SortBy,
  visibilityFilter: VisibilityFilter,
  hideForks: boolean,
  pinnedRepoIds: number[]
): GitHubRepo[] {
  let result = repos

  // Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    result = result.filter(
      (repo) =>
        repo.name.toLowerCase().includes(q) ||
        repo.full_name.toLowerCase().includes(q) ||
        (repo.description?.toLowerCase().includes(q) ?? false)
    )
  }

  // Language filter
  if (languageFilter) {
    result = result.filter(
      (repo) => repo.language?.toLowerCase() === languageFilter.toLowerCase()
    )
  }

  // Visibility filter
  if (visibilityFilter === 'public') {
    result = result.filter((r) => !r.private)
  } else if (visibilityFilter === 'private') {
    result = result.filter((r) => r.private)
  }

  // Hide forks
  if (hideForks) {
    result = result.filter((r) => !r.fork)
  }

  // Sort
  const sorted = [...result]
  if (sortBy === 'recent') {
    sorted.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  } else if (sortBy === 'stars') {
    sorted.sort((a, b) => b.stargazers_count - a.stargazers_count)
  } else if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Pinned to top (stable — pinned keeps relative order from sort)
  const pinnedSet = new Set(pinnedRepoIds)
  const pinned = sorted.filter((r) => pinnedSet.has(r.id))
  const unpinned = sorted.filter((r) => !pinnedSet.has(r.id))

  return [...pinned, ...unpinned]
}

export const useRepoStore = create<RepoStore>()(
  persist(
    (set, get) => ({
      repos: [],
      filteredRepos: [],
      loading: false,
      error: null,
      searchQuery: '',
      languageFilter: null,
      viewMode: 'grid',
      sortBy: 'recent' as SortBy,
      visibilityFilter: 'all' as VisibilityFilter,
      hideForks: false,
      pinnedRepoIds: [],

      setRepos: (repos) => {
        const s = get()
        set({
          repos,
          filteredRepos: applyFiltersAndSort(
            repos,
            s.searchQuery,
            s.languageFilter,
            s.sortBy,
            s.visibilityFilter,
            s.hideForks,
            s.pinnedRepoIds
          ),
        })
      },

      setSearchQuery: (searchQuery) => {
        const s = get()
        set({
          searchQuery,
          filteredRepos: applyFiltersAndSort(
            s.repos,
            searchQuery,
            s.languageFilter,
            s.sortBy,
            s.visibilityFilter,
            s.hideForks,
            s.pinnedRepoIds
          ),
        })
      },

      setLanguageFilter: (languageFilter) => {
        const s = get()
        set({
          languageFilter,
          filteredRepos: applyFiltersAndSort(
            s.repos,
            s.searchQuery,
            languageFilter,
            s.sortBy,
            s.visibilityFilter,
            s.hideForks,
            s.pinnedRepoIds
          ),
        })
      },

      setSortBy: (sortBy) => {
        const s = get()
        set({
          sortBy,
          filteredRepos: applyFiltersAndSort(
            s.repos,
            s.searchQuery,
            s.languageFilter,
            sortBy,
            s.visibilityFilter,
            s.hideForks,
            s.pinnedRepoIds
          ),
        })
      },

      setVisibilityFilter: (visibilityFilter) => {
        const s = get()
        set({
          visibilityFilter,
          filteredRepos: applyFiltersAndSort(
            s.repos,
            s.searchQuery,
            s.languageFilter,
            s.sortBy,
            visibilityFilter,
            s.hideForks,
            s.pinnedRepoIds
          ),
        })
      },

      setHideForks: (hideForks) => {
        const s = get()
        set({
          hideForks,
          filteredRepos: applyFiltersAndSort(
            s.repos,
            s.searchQuery,
            s.languageFilter,
            s.sortBy,
            s.visibilityFilter,
            hideForks,
            s.pinnedRepoIds
          ),
        })
      },

      togglePinned: (id) => {
        const s = get()
        const next = s.pinnedRepoIds.includes(id)
          ? s.pinnedRepoIds.filter((p) => p !== id)
          : [...s.pinnedRepoIds, id]
        set({
          pinnedRepoIds: next,
          filteredRepos: applyFiltersAndSort(
            s.repos,
            s.searchQuery,
            s.languageFilter,
            s.sortBy,
            s.visibilityFilter,
            s.hideForks,
            next
          ),
        })
      },

      isPinned: (id) => get().pinnedRepoIds.includes(id),

      setViewMode: (viewMode) => set({ viewMode }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'codesync-repo-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        viewMode: s.viewMode,
        sortBy: s.sortBy,
        visibilityFilter: s.visibilityFilter,
        hideForks: s.hideForks,
        pinnedRepoIds: s.pinnedRepoIds,
      }),
    }
  )
)
