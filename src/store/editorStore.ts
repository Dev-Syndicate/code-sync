import { create } from 'zustand'
import type { EditorTab, EditorSettings } from '@/types/editor'
import { DEFAULT_EDITOR_SETTINGS } from '@/types/editor'

// ── File tree node for sidebar ──
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  language?: string
  children?: FileNode[]
}

// ── Editor Store State ──
interface EditorState {
  // Tab management
  tabs: EditorTab[]
  activeFile: string | null

  // File tree
  files: FileNode[]

  // Settings
  settings: EditorSettings

  // Actions — Tab management
  openFile: (path: string, language: string, content: string, sha: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  markDirty: (path: string, dirty: boolean) => void

  // Actions — File tree
  setFiles: (files: FileNode[]) => void

  // Actions — Settings
  updateSettings: (settings: Partial<EditorSettings>) => void

  // Computed (exposed as functions per integration contract)
  getDirtyFiles: () => EditorTab[]
  getFileContent: (path: string) => string | undefined
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeFile: null,
  files: [],
  settings: DEFAULT_EDITOR_SETTINGS,

  openFile: (path, language, content, sha) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.path === path)

    if (existing) {
      // Already open — just activate it
      set({
        tabs: tabs.map((t) => ({ ...t, isActive: t.path === path })),
        activeFile: path,
      })
      return
    }

    // Open new tab
    const newTab: EditorTab = {
      path,
      language,
      content,
      isActive: true,
      isDirty: false,
      originalSha: sha,
    }

    set({
      tabs: [...tabs.map((t) => ({ ...t, isActive: false })), newTab],
      activeFile: path,
    })
  },

  closeFile: (path) => {
    const { tabs, activeFile } = get()
    const filtered = tabs.filter((t) => t.path !== path)

    let newActive = activeFile
    if (activeFile === path) {
      // Activate the last remaining tab, or null
      newActive = filtered.length > 0 ? filtered[filtered.length - 1].path : null
    }

    set({
      tabs: filtered.map((t) => ({ ...t, isActive: t.path === newActive })),
      activeFile: newActive,
    })
  },

  setActiveFile: (path) => {
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, isActive: t.path === path })),
      activeFile: path,
    }))
  },

  updateFileContent: (path, content) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path ? { ...t, content, isDirty: true } : t
      ),
    }))
  },

  markDirty: (path, dirty) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path ? { ...t, isDirty: dirty } : t
      ),
    }))
  },

  setFiles: (files) => set({ files }),

  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }))
  },

  // ── Integration contract for Dev 4 ──
  getDirtyFiles: () => get().tabs.filter((t) => t.isDirty),

  getFileContent: (path) => {
    const tab = get().tabs.find((t) => t.path === path)
    return tab?.content
  },
}))
