'use client'

// Explorer header with VS Code-style action icons. Shown above the file
// tree in the left sidebar. Icons appear on hover (matches VS Code) but
// stay visible on small-screen / no-hover.

import { FilePlus, FolderPlus, RefreshCw, ChevronsDownUp } from 'lucide-react'

interface Props {
  onNewFile: () => void
  onNewFolder: () => void
  onRefresh: () => void
  onCollapseAll: () => void
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
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/40">
        Explorer
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
