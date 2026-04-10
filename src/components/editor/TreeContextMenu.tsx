'use client'

// Lightweight positioned menu for the Explorer right-click. Uses a fixed
// wrapper anchored to the mouse event's client coordinates, with an
// overlay click-outside catcher. Matches VS Code's Explorer menu: New
// File / New Folder / Rename / Delete / Cut / Copy / Paste.

import { useEffect, useRef } from 'react'
import {
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Scissors,
  Copy,
  ClipboardPaste,
  type LucideIcon,
} from 'lucide-react'

export interface TreeContextMenuProps {
  x: number
  y: number
  targetType: 'file' | 'directory' | 'background'
  canPaste: boolean
  onNewFile: () => void
  onNewFolder: () => void
  onRename: () => void
  onDelete: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onClose: () => void
}

interface MenuItem {
  key: string
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
  shortcut?: string
  destructive?: boolean
}

export function TreeContextMenu(props: TreeContextMenuProps) {
  const {
    x,
    y,
    targetType,
    canPaste,
    onNewFile,
    onNewFolder,
    onRename,
    onDelete,
    onCut,
    onCopy,
    onPaste,
    onClose,
  } = props

  const menuRef = useRef<HTMLDivElement>(null)

  // Close on Escape or outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Nudge the menu on-screen if it'd overflow the viewport.
  const adjusted = useAdjustedPosition(menuRef, x, y)

  const isFile = targetType === 'file'
  const isDir = targetType === 'directory'
  const isBg = targetType === 'background'

  const items: Array<MenuItem | 'separator'> = [
    {
      key: 'new-file',
      label: 'New File',
      icon: FilePlus,
      onClick: onNewFile,
    },
    {
      key: 'new-folder',
      label: 'New Folder',
      icon: FolderPlus,
      onClick: onNewFolder,
    },
    ...(isBg
      ? []
      : [
          'separator' as const,
          {
            key: 'rename',
            label: 'Rename',
            icon: Pencil,
            shortcut: 'F2',
            onClick: onRename,
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            shortcut: 'Del',
            onClick: onDelete,
            destructive: true,
          },
          'separator' as const,
          {
            key: 'cut',
            label: 'Cut',
            icon: Scissors,
            shortcut: 'Ctrl+X',
            onClick: onCut,
          },
          {
            key: 'copy',
            label: 'Copy',
            icon: Copy,
            shortcut: 'Ctrl+C',
            onClick: onCopy,
          },
        ]),
    ...((isFile || isDir || isBg) && canPaste
      ? [
          ...(isBg ? ['separator' as const] : []),
          {
            key: 'paste',
            label: 'Paste',
            icon: ClipboardPaste,
            shortcut: 'Ctrl+V',
            onClick: onPaste,
            disabled: !canPaste,
          },
        ]
      : []),
  ]

  return (
    <>
      {/* Click-outside catcher */}
      <div
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'transparent',
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: 'fixed',
          left: adjusted.x,
          top: adjusted.y,
          zIndex: 1001,
          minWidth: 200,
          background: 'var(--bg-surface, #1e1e1e)',
          border: '1px solid var(--border-default, #333)',
          borderRadius: 'var(--radius-md, 6px)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          padding: '4px 0',
          fontSize: 'var(--text-sm, 13px)',
          color: 'var(--text-primary, #e4e4e7)',
        }}
      >
        {items.map((item, i) =>
          item === 'separator' ? (
            <div
              key={`sep-${i}`}
              style={{
                height: 1,
                margin: '4px 0',
                background: 'var(--border-default, #333)',
              }}
            />
          ) : (
            <MenuItem
              key={item.key}
              item={item}
              onActivate={() => {
                if (item.disabled) return
                item.onClick()
                onClose()
              }}
            />
          )
        )}
      </div>
    </>
  )
}

function MenuItem({
  item,
  onActivate,
}: {
  item: MenuItem
  onActivate: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onActivate}
      disabled={item.disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        background: 'transparent',
        border: 'none',
        color: item.disabled
          ? 'var(--text-muted, #6b7280)'
          : item.destructive
            ? '#f87171'
            : 'var(--text-primary, #e4e4e7)',
        cursor: item.disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        fontSize: 'inherit',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!item.disabled) {
          e.currentTarget.style.background =
            'var(--bg-hover, rgba(255,255,255,0.06))'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon size={14} strokeWidth={1.75} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.shortcut && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted, #6b7280)',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {item.shortcut}
        </span>
      )}
    </button>
  )
}

// Hook: measure the menu after mount and nudge it back on-screen if it
// spills out the bottom or right edge of the viewport.
function useAdjustedPosition(
  ref: React.RefObject<HTMLDivElement | null>,
  x: number,
  y: number
): { x: number; y: number } {
  // Initial pass uses raw coords; after layout, we snap inward. Because
  // this hook is called unconditionally and state is local, we use a
  // ref-based self-correction via requestAnimationFrame.
  const adjustedRef = useRef({ x, y })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (rect.right > window.innerWidth) {
      nx = Math.max(4, window.innerWidth - rect.width - 4)
    }
    if (rect.bottom > window.innerHeight) {
      ny = Math.max(4, window.innerHeight - rect.height - 4)
    }
    if (nx !== adjustedRef.current.x || ny !== adjustedRef.current.y) {
      adjustedRef.current = { x: nx, y: ny }
      el.style.left = `${nx}px`
      el.style.top = `${ny}px`
    }
  }, [ref, x, y])
  return { x, y }
}
