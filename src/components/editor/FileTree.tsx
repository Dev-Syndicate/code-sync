'use client'

import { useState, useCallback } from 'react'
import { useEditorStore, type FileNode } from '@/store/editorStore'

// ── Language → emoji icon mapping ──
const FILE_ICONS: Record<string, string> = {
  typescript: '🟦',
  javascript: '🟨',
  typescriptreact: '⚛️',
  javascriptreact: '⚛️',
  json: '📋',
  markdown: '📝',
  css: '🎨',
  html: '🌐',
  python: '🐍',
  rust: '🦀',
  go: '🐹',
  yaml: '⚙️',
  toml: '⚙️',
  shell: '💻',
  dockerfile: '🐳',
}

const FOLDER_ICON_OPEN = '📂'
const FOLDER_ICON_CLOSED = '📁'

interface FileTreeProps {
  className?: string
}

export function FileTree({ className = '' }: FileTreeProps) {
  const files = useEditorStore((s) => s.files)
  const activeFile = useEditorStore((s) => s.activeFile)
  const openFile = useEditorStore((s) => s.openFile)

  if (files.length === 0) {
    return (
      <div className={`p-4 text-sm text-[var(--foreground)]/40 ${className}`}>
        No files loaded
      </div>
    )
  }

  return (
    <div className={`overflow-y-auto text-sm select-none ${className}`}>
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/40">
        Explorer
      </div>
      <div className="px-1">
        {files.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            onFileClick={openFile}
          />
        ))}
      </div>
    </div>
  )
}

// ── Recursive tree node ──
interface TreeNodeProps {
  node: FileNode
  depth: number
  activeFile: string | null
  onFileClick: (path: string, language: string, content: string, sha: string) => void
}

function TreeNode({ node, depth, activeFile, onFileClick }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)

  const handleClick = useCallback(() => {
    if (node.type === 'directory') {
      setIsExpanded((prev) => !prev)
    } else {
      // Open file tab — content is loaded from Yjs/API, pass empty for now
      onFileClick(node.path, node.language ?? 'plaintext', '', '')
    }
  }, [node, onFileClick])

  const isActive = node.type === 'file' && node.path === activeFile
  const icon =
    node.type === 'directory'
      ? isExpanded
        ? FOLDER_ICON_OPEN
        : FOLDER_ICON_CLOSED
      : FILE_ICONS[node.language ?? ''] ?? '📄'

  return (
    <div>
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left
          transition-colors duration-100 cursor-pointer
          ${
            isActive
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-[var(--foreground)]/70 hover:bg-[var(--foreground)]/8 hover:text-[var(--foreground)]'
          }
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={node.path}
      >
        <span className="text-xs shrink-0">{icon}</span>
        <span className="truncate">{node.name}</span>
        {node.type === 'directory' && (
          <span className="ml-auto text-[10px] text-[var(--foreground)]/30">
            {isExpanded ? '▾' : '▸'}
          </span>
        )}
      </button>

      {/* Children (recursive) */}
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
