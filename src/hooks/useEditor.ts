'use client'

import { useEditorStore } from '@/store/editorStore'

/**
 * Convenience hook wrapping editorStore selectors.
 * Provides a clean API for components that need editor state.
 */
export function useEditor() {
  const tabs = useEditorStore((s) => s.tabs)
  const activeFile = useEditorStore((s) => s.activeFile)
  const files = useEditorStore((s) => s.files)
  const settings = useEditorStore((s) => s.settings)
  const openFile = useEditorStore((s) => s.openFile)
  const closeFile = useEditorStore((s) => s.closeFile)
  const setActiveFile = useEditorStore((s) => s.setActiveFile)
  const updateFileContent = useEditorStore((s) => s.updateFileContent)
  const markDirty = useEditorStore((s) => s.markDirty)
  const setFiles = useEditorStore((s) => s.setFiles)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const getDirtyFiles = useEditorStore((s) => s.getDirtyFiles)
  const getFileContent = useEditorStore((s) => s.getFileContent)

  const activeTab = tabs.find((t) => t.path === activeFile) ?? null

  return {
    // State
    tabs,
    activeFile,
    activeTab,
    files,
    settings,
    dirtyFiles: getDirtyFiles(),

    // Actions
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
    markDirty,
    setFiles,
    updateSettings,
    getFileContent,
  }
}
