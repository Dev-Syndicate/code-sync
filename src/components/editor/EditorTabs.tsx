'use client'

import { useEditorStore } from '@/store/editorStore'

// ── Language → accent color ──
const LANG_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  javascript: '#f7df1e',
  typescriptreact: '#3178c6',
  javascriptreact: '#f7df1e',
  json: '#6d8086',
  css: '#1572b6',
  html: '#e44d26',
  markdown: '#083fa1',
  python: '#3776ab',
  rust: '#dea584',
  go: '#00add8',
}

interface EditorTabsProps {
  className?: string
}

export function EditorTabs({ className = '' }: EditorTabsProps) {
  const tabs = useEditorStore((s) => s.tabs)
  const activeFile = useEditorStore((s) => s.activeFile)
  const setActiveFile = useEditorStore((s) => s.setActiveFile)
  const closeFile = useEditorStore((s) => s.closeFile)

  if (tabs.length === 0) {
    return (
      <div
        className={`flex items-center px-4 h-9 border-b border-[var(--foreground)]/10 text-xs text-[var(--foreground)]/30 ${className}`}
      >
        No files open
      </div>
    )
  }

  return (
    <div
      className={`flex items-stretch overflow-x-auto border-b border-[var(--foreground)]/10 bg-[var(--foreground)]/3 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.path === activeFile
        const fileName = tab.path.split('/').pop() ?? tab.path
        const accentColor = LANG_COLORS[tab.language] ?? '#888'

        return (
          <div
            key={tab.path}
            className={`
              group relative flex items-center gap-2 px-3 h-9 text-xs
              border-r border-[var(--foreground)]/8 cursor-pointer select-none
              transition-colors duration-100 shrink-0
              ${
                isActive
                  ? 'bg-[var(--background)] text-[var(--foreground)]'
                  : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]/80 hover:bg-[var(--foreground)]/5'
              }
            `}
            onClick={() => setActiveFile(tab.path)}
            title={tab.path}
          >
            {/* Language accent bar */}
            {isActive && (
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: accentColor }}
              />
            )}

            {/* Dirty indicator */}
            {tab.isDirty && (
              <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
            )}

            {/* File name */}
            <span className="truncate max-w-32">{fileName}</span>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeFile(tab.path)
              }}
              className="
                p-0.5 rounded opacity-0 group-hover:opacity-100
                hover:bg-[var(--foreground)]/15 transition-opacity cursor-pointer
              "
              aria-label={`Close ${fileName}`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M9 3L3 9M3 3l6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
