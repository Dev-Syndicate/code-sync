'use client'

// Explorer header with VS Code-style action icons. Shown above the file
// tree in the left sidebar. Actions are always visible (low-opacity at
// rest, full-opacity on hover) so first-time users don't have to discover
// them by hovering.

import { FilePlus, FolderPlus, RefreshCw, ChevronsDownUp } from 'lucide-react'

interface Props {
  onNewFile: () => void
  onNewFolder: () => void
  onRefresh: () => void
  onCollapseAll: () => void
  /** File count shown as a small badge next to the EXPLORER label. */
  fileCount?: number
}

interface ActionButton {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  onClick: () => void
}

export function ExplorerHeader({
  onNewFile,
  onNewFolder,
  onRefresh,
  onCollapseAll,
  fileCount,
}: Props) {
  const actions: ActionButton[] = [
    { key: 'new-file', label: 'New File', icon: FilePlus, onClick: onNewFile },
    {
      key: 'new-folder',
      label: 'New Folder',
      icon: FolderPlus,
      onClick: onNewFolder,
    },
    { key: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: onRefresh },
    {
      key: 'collapse',
      label: 'Collapse All',
      icon: ChevronsDownUp,
      onClick: onCollapseAll,
    },
  ]

  return (
    <div
      className="group flex items-center justify-between px-3 py-2"
      style={{
        borderBottom: '1px solid var(--border-default, transparent)',
      }}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/40">
        Explorer
        {typeof fileCount === 'number' && fileCount > 0 && (
          <span className="rounded-full bg-[var(--foreground)]/8 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-[var(--foreground)]/55 normal-case tracking-normal">
            {fileCount}
          </span>
        )}
      </span>
      <div className="flex items-center gap-0.5 opacity-40 transition-opacity group-hover:opacity-100">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.key}
              type="button"
              onClick={a.onClick}
              aria-label={a.label}
              title={a.label}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--foreground)]/60 hover:bg-[var(--foreground)]/10 hover:text-[var(--foreground)]"
            >
              <Icon size={14} strokeWidth={1.75} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
