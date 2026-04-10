'use client'

import { useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileCode2,
  FileJson,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Settings2,
  Terminal,
  type LucideIcon,
} from 'lucide-react'
import { useEditorStore, type FileNode } from '@/store/editorStore'

// Track per-path loading state so clicking a file shows a subtle spinner
// instead of looking frozen while we hit /api/repos for its content.
type LoadingMap = Record<string, boolean>

// ── Language → icon + tint color (VS Code-ish palette) ──
interface IconMeta {
  Icon: LucideIcon
  color: string
}

const LANGUAGE_ICON: Record<string, IconMeta> = {
  typescript:       { Icon: FileCode,  color: '#3178c6' },
  typescriptreact:  { Icon: FileCode2, color: '#61dafb' },
  javascript:       { Icon: FileCode,  color: '#f7df1e' },
  javascriptreact:  { Icon: FileCode2, color: '#61dafb' },
  python:           { Icon: FileCode,  color: '#3776ab' },
  rust:             { Icon: FileCode,  color: '#dea584' },
  go:               { Icon: FileCode,  color: '#00add8' },
  java:             { Icon: FileCode,  color: '#b07219' },
  c:                { Icon: FileCode,  color: '#555555' },
  cpp:              { Icon: FileCode,  color: '#f34b7d' },
  csharp:           { Icon: FileCode,  color: '#178600' },
  php:              { Icon: FileCode,  color: '#4F5D95' },
  ruby:             { Icon: FileCode,  color: '#701516' },
  swift:            { Icon: FileCode,  color: '#F05138' },
  kotlin:           { Icon: FileCode,  color: '#A97BFF' },
  json:             { Icon: FileJson,  color: '#cbcb41' },
  yaml:             { Icon: Settings2, color: '#cbcb41' },
  toml:             { Icon: Settings2, color: '#9c4221' },
  html:             { Icon: FileType,  color: '#e34c26' },
  css:              { Icon: FileType,  color: '#563d7c' },
  scss:             { Icon: FileType,  color: '#c6538c' },
  markdown:         { Icon: FileText,  color: '#519aba' },
  shell:            { Icon: Terminal,  color: '#89e051' },
  dockerfile:       { Icon: Terminal,  color: '#0db7ed' },
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'])

function getFileIcon(node: FileNode): IconMeta {
  const lang = node.language?.toLowerCase() ?? ''
  if (lang && LANGUAGE_ICON[lang]) return LANGUAGE_ICON[lang]

  // Fallback by extension (useful for image files where language is 'plaintext')
  const ext = node.name.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTS.has(ext)) return { Icon: ImageIcon, color: '#a074c4' }
  if (ext === 'md')        return { Icon: FileText,  color: '#519aba' }
  if (ext === 'json')      return { Icon: FileJson,  color: '#cbcb41' }
  if (ext === 'sh' || ext === 'bash' || ext === 'zsh') {
    return { Icon: Terminal, color: '#89e051' }
  }
  if (node.name.toLowerCase().startsWith('dockerfile')) {
    return { Icon: Terminal, color: '#0db7ed' }
  }
  if (node.name.startsWith('.') || ext === 'env' || ext === 'gitignore') {
    return { Icon: Settings2, color: '#6d8086' }
  }

  return { Icon: File, color: '#8fa1a8' }
}

interface FileTreeProps {
  className?: string
  repoOwner?: string | null
  repoName?: string | null
  sessionId?: string | null
}

export function FileTree({
  className = '',
  repoOwner = null,
  repoName = null,
  sessionId = null,
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

        // Draft restore: prefer saved draft over GitHub content when the draft
        // is still current (originalSha matches the file's current GitHub sha).
        if (sessionId) {
          try {
            const draftRes = await fetch(
              `/api/sessions/${sessionId}/load-draft?path=${encodeURIComponent(path)}`,
              { credentials: 'same-origin' }
            )
            if (draftRes.ok) {
              const draftJson = await draftRes.json()
              const draft = draftJson?.data?.draft
              if (draft) {
                if (draft.originalSha === file.sha) {
                  openFile(path, language, draft.content, file.sha)
                  return
                } else {
                  // Stale draft — file changed on GitHub since the draft was saved
                  console.warn('[FileTree] stale draft discarded for', path)
                }
              }
            }
          } catch {
            // Draft fetch failed — fall through to GitHub content
          }
        }

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
    [repoOwner, repoName, sessionId, openFile]
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

  // Pick icon + color for the leading glyph
  const { Icon, color } =
    node.type === 'directory'
      ? {
          Icon: isExpanded ? FolderOpen : Folder,
          color: '#dcb67a', // warm VS Code folder yellow
        }
      : getFileIcon(node)

  // Chevron for directories (rotated on expand)
  const Chevron = isExpanded ? ChevronDown : ChevronRight

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          w-full flex items-center gap-1 px-1.5 py-1 rounded-md text-left
          transition-colors duration-100 cursor-pointer
          ${
            isActive
              ? 'bg-primary/15 text-primary'
              : 'text-[var(--foreground)]/75 hover:bg-[var(--foreground)]/10 hover:text-[var(--foreground)]'
          }
          ${isLoading ? 'opacity-60 cursor-wait' : ''}
        `}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        title={node.path}
      >
        {/* Chevron for folders, invisible spacer for files so names align */}
        {node.type === 'directory' ? (
          <Chevron className="h-3.5 w-3.5 shrink-0 opacity-60" />
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden />
        )}

        {/* File/folder icon */}
        <Icon
          className="h-4 w-4 shrink-0"
          style={{ color }}
          strokeWidth={isActive ? 2 : 1.75}
        />

        {/* Name */}
        <span className="truncate">{node.name}</span>

        {isLoading && (
          <span className="ml-auto text-[10px] opacity-60">loading</span>
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
