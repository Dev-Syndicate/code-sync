'use client'

import { useState, useCallback } from 'react'
import { useEditorStore, type FileNode } from '@/store/editorStore'

// Track per-path loading state so clicking a file shows a subtle spinner
// instead of looking frozen while we hit /api/repos for its content.
type LoadingMap = Record<string, boolean>

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
  repoOwner?: string | null
  repoName?: string | null
}

export function FileTree({
  className = '',
  repoOwner = null,
  repoName = null,
}: FileTreeProps) {
  const files = useEditorStore((s) => s.files)
  const activeFile = useEditorStore((s) => s.activeFile)
  const openFile = useEditorStore((s) => s.openFile)

  const [loadingMap, setLoadingMap] = useState<LoadingMap>({})

  // Fetch a file's content from GitHub via /api/repos when the user clicks
  // a leaf node. The session doc only stores path/sha/language (from the
  // git/trees API); actual contents come from /repos/{o}/{r}/contents/{p}.
  const handleFileClick = useCallback(
    async (path: string, language: string, _content: string, sha: string) => {
      // If no repo context yet (session still loading), bail out gracefully.
      if (!repoOwner || !repoName) {
        console.warn('[FileTree] no repo context, cannot load file:', path)
        return
      }

      // If the file is already open, openFile() just re-activates the tab.
      // Short-circuit to avoid a pointless network round-trip.
      const alreadyOpen = useEditorStore
        .getState()
        .tabs.some((t) => t.path === path)
      if (alreadyOpen) {
        openFile(path, language, '', sha)
        return
      }

      setLoadingMap((m) => ({ ...m, [path]: true }))
      try {
        const url = `/api/repos?owner=${encodeURIComponent(repoOwner)}&repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}`
        const res = await fetch(url, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (!res.ok) {
          console.error('[FileTree] file fetch failed:', res.status, path)
          return
        }
        const json = await res.json()
        if (!json?.success || !json.data) {
          console.error('[FileTree] malformed file response for', path)
          return
        }
        const file = json.data as {
          path: string
          content: string
          sha: string
          encoding: 'base64'
        }
        // GitHub returns content base64-encoded. Decode to UTF-8 text.
        const decoded = decodeBase64Utf8(file.content)
        openFile(path, language, decoded, file.sha)
      } catch (err) {
        console.error('[FileTree] file fetch threw:', err)
      } finally {
        setLoadingMap((m) => {
          const next = { ...m }
          delete next[path]
          return next
        })
      }
    },
    [repoOwner, repoName, openFile]
  )

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
            loadingMap={loadingMap}
            onFileClick={handleFileClick}
          />
        ))}
      </div>
    </div>
  )
}

// GitHub's contents API returns content as base64 with embedded newlines.
// atob handles ASCII but mangles multi-byte UTF-8; this wraps it so source
// files with non-ASCII characters (comments, strings) decode correctly.
function decodeBase64Utf8(b64: string): string {
  const clean = b64.replace(/\n/g, '')
  try {
    const bin = atob(clean)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return ''
  }
}

// ── Recursive tree node ──
interface TreeNodeProps {
  node: FileNode
  depth: number
  activeFile: string | null
  loadingMap: LoadingMap
  onFileClick: (path: string, language: string, content: string, sha: string) => void
}

function TreeNode({ node, depth, activeFile, loadingMap, onFileClick }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)

  const handleClick = useCallback(() => {
    if (node.type === 'directory') {
      setIsExpanded((prev) => !prev)
    } else {
      // content/sha are resolved by FileTree.handleFileClick; we just
      // forward the tree-node metadata it needs to build the request.
      void onFileClick(node.path, node.language ?? 'plaintext', '', '')
    }
  }, [node, onFileClick])

  const isLoading = node.type === 'file' && loadingMap[node.path]

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
        disabled={isLoading}
        className={`
          w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left
          transition-colors duration-100 cursor-pointer
          ${
            isActive
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-[var(--foreground)]/70 hover:bg-[var(--foreground)]/8 hover:text-[var(--foreground)]'
          }
          ${isLoading ? 'opacity-60 cursor-wait' : ''}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={node.path}
      >
        <span className="text-xs shrink-0">{icon}</span>
        <span className="truncate">{node.name}</span>
        {isLoading && (
          <span className="ml-auto text-[10px] opacity-60">⏳</span>
        )}
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
              loadingMap={loadingMap}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
