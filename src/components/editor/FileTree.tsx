'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type * as Y from 'yjs'
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
import { useToastStore } from '@/store/toastStore'
import { useFileTreeOps } from '@/hooks/useFileTreeOps'
import { ExplorerHeader } from './ExplorerHeader'
import { TreeInlineInput } from './TreeInlineInput'
import { TreeContextMenu } from './TreeContextMenu'

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

// ── Types for transient UI state ──────────────────────────────────────────
type PendingInput =
  | { kind: 'rename'; path: string }
  | { kind: 'new-file'; parentPath: string | null }
  | { kind: 'new-folder'; parentPath: string | null }

interface ContextMenuState {
  x: number
  y: number
  targetType: 'file' | 'directory' | 'background'
  targetPath: string | null
}

// ── Props ────────────────────────────────────────────────────────────────
interface FileTreeProps {
  className?: string
  repoOwner?: string | null
  repoName?: string | null
  sessionId?: string | null
  ydoc?: Y.Doc | null
}

export function FileTree({
  className = '',
  repoOwner = null,
  repoName = null,
  sessionId = null,
  ydoc = null,
}: FileTreeProps) {
  const files = useEditorStore((s) => s.files)
  const activeFile = useEditorStore((s) => s.activeFile)
  const openFile = useEditorStore((s) => s.openFile)
  const clipboard = useEditorStore((s) => s.clipboard)
  const mergeRefreshedTree = useEditorStore((s) => s.mergeRefreshedTree)

  const addToast = useToastStore((s) => s.addToast)

  const ops = useFileTreeOps({ ydoc })

  const [isRefreshing, setIsRefreshing] = useState(false)

  const [loadingMap, setLoadingMap] = useState<LoadingMap>({})

  // Which tree node is "selected" for keyboard shortcuts (F2 rename, Del,
  // Ctrl+X/C/V). Separate from activeFile because you can select a folder
  // in the Explorer without opening it.
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Transient inline input state (rename or new-item).
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null)

  // Expanded directories. Lifted out of TreeNode so "Collapse All" is a
  // single `setExpandedPaths(new Set())` call instead of a useEffect
  // cascade. Seeded once from the initial tree (everything up to depth 2
  // open, matching the old behavior). We re-seed only when the tree goes
  // from empty to non-empty — not on every tree edit, so user expansion
  // state survives create/rename/delete.
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set()
  )
  const hasSeededExpansion = useRef(false)
  useEffect(() => {
    if (hasSeededExpansion.current) return
    if (files.length === 0) return
    hasSeededExpansion.current = true
    const seed = new Set<string>()
    const walk = (nodes: FileNode[], depth: number) => {
      for (const n of nodes) {
        if (n.type === 'directory') {
          if (depth < 2) seed.add(n.path)
          if (n.children) walk(n.children, depth + 1)
        }
      }
    }
    walk(files, 0)
    setExpandedPaths(seed)
  }, [files])

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // Context menu state (null when closed).
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
    null
  )

  // Ref to the outer container so we can scope keyboard shortcuts to
  // "focus is inside the Explorer" without stealing them from the editor.
  const containerRef = useRef<HTMLDivElement>(null)

  // ── File fetch (unchanged from before) ─────────────────────────────────
  const handleFileClick = useCallback(
    async (path: string, language: string, _content: string, sha: string) => {
      // If no repo context yet (session still loading), bail out gracefully.
      if (!repoOwner || !repoName) {
        console.warn('[FileTree] no repo context, cannot load file:', path)
        return
      }

      // If the file was created locally (isNew) or is already open, just
      // activate its tab — no GitHub fetch.
      const alreadyOpen = useEditorStore
        .getState()
        .tabs.some((t) => t.path === path)
      if (alreadyOpen) {
        openFile(path, language, '', sha || null)
        return
      }

      // Local-only new file that isn't in tabs anymore? Re-open empty.
      const node = useEditorStore.getState().findNode(path)
      if (node?.isNew) {
        openFile(path, language, '', null)
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

        // Draft restore: prefer saved draft over GitHub content when the
        // draft is still current (originalSha matches the current sha).
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
                  console.warn('[FileTree] stale draft discarded for', path)
                }
              }
            }
          } catch {
            /* fall through to GitHub content */
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

  // ── Header actions ─────────────────────────────────────────────────────
  const handleNewFileAtRoot = useCallback(() => {
    // Use the selected node's parent if a node is selected, otherwise root.
    const target = resolveCreateParent(selectedPath)
    setPendingInput({ kind: 'new-file', parentPath: target })
  }, [selectedPath])

  const handleNewFolderAtRoot = useCallback(() => {
    const target = resolveCreateParent(selectedPath)
    setPendingInput({ kind: 'new-folder', parentPath: target })
  }, [selectedPath])

  const handleRefresh = useCallback(async () => {
    if (!sessionId || isRefreshing) return
    setIsRefreshing(true)
    // Clear any stuck per-path loading markers on the way in.
    setLoadingMap({})

    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/refresh-tree`,
        { method: 'GET', cache: 'no-store', credentials: 'same-origin' }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg = body?.error?.message ?? `Refresh failed (${res.status})`
        addToast('error', msg)
        return
      }
      const json = await res.json()
      const refreshed: Array<{
        path: string
        sha: string
        language: string
      }> = json?.data?.files ?? []

      const result = mergeRefreshedTree(refreshed)

      // ── Emit toasts based on the diff ────────────────────────────
      // Clean, informative, one-per-category so we don't spam 20 toasts
      // when a large branch moves forward.
      if (result.addedFiles.length > 0) {
        const n = result.addedFiles.length
        const sample = result.addedFiles.slice(0, 3).join(', ')
        const more = n > 3 ? ` and ${n - 3} more` : ''
        addToast(
          'success',
          `Pulled ${n} new file${n === 1 ? '' : 's'} from GitHub: ${sample}${more}`
        )
      }
      if (result.removedFiles.length > 0) {
        const n = result.removedFiles.length
        const sample = result.removedFiles.slice(0, 3).join(', ')
        const more = n > 3 ? ` and ${n - 3} more` : ''
        addToast(
          'info',
          `${n} file${n === 1 ? ' was' : 's were'} removed on GitHub: ${sample}${more}`
        )
      }
      if (result.survivedAsNew.length > 0) {
        for (const path of result.survivedAsNew) {
          addToast(
            'warning',
            `"${path}" was deleted on GitHub, but your unsaved edits are kept. Commit to re-create it.`
          )
        }
      }
      if (result.staleDirtyFiles.length > 0) {
        for (const path of result.staleDirtyFiles) {
          addToast(
            'warning',
            `"${path}" has been updated on GitHub. Your unsaved edits are based on an older version — committing will overwrite the newer one.`
          )
        }
      }

      if (
        result.addedFiles.length === 0 &&
        result.removedFiles.length === 0 &&
        result.survivedAsNew.length === 0 &&
        result.staleDirtyFiles.length === 0
      ) {
        addToast('info', 'Already up to date with GitHub.')
      }
    } catch (err) {
      console.error('[FileTree] refresh failed:', err)
      addToast('error', 'Refresh failed. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }, [sessionId, isRefreshing, mergeRefreshedTree, addToast])

  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set())
  }, [])

  // ── Context menu open ──────────────────────────────────────────────────
  const openContextMenu = useCallback(
    (
      e: React.MouseEvent,
      target: { type: 'file' | 'directory' | 'background'; path: string | null }
    ) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetType: target.type,
        targetPath: target.path,
      })
      if (target.path) setSelectedPath(target.path)
    },
    []
  )

  // ── Keyboard shortcuts scoped to the Explorer ─────────────────────────
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      // Ignore keystrokes coming from inside an input (rename in progress).
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'F2' && selectedPath) {
        e.preventDefault()
        setPendingInput({ kind: 'rename', path: selectedPath })
      } else if (e.key === 'Delete' && selectedPath) {
        e.preventDefault()
        if (confirm(`Delete "${selectedPath}"?`)) {
          ops.deleteNode(selectedPath)
          setSelectedPath(null)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedPath) {
        e.preventDefault()
        ops.cut(selectedPath)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedPath) {
        e.preventDefault()
        ops.copy(selectedPath)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        const dest = resolveCreateParent(selectedPath)
        ops.paste(dest)
      }
    },
    [selectedPath, ops]
  )

  // ── Pending input commit ──────────────────────────────────────────────
  const commitPendingInput = useCallback(
    (value: string) => {
      if (!pendingInput) return
      if (pendingInput.kind === 'rename') {
        const created = ops.renameNode(pendingInput.path, value)
        if (created) setSelectedPath(created)
      } else if (pendingInput.kind === 'new-file') {
        const created = ops.createFile(pendingInput.parentPath, value)
        if (created) setSelectedPath(created)
      } else {
        const created = ops.createFolder(pendingInput.parentPath, value)
        if (created) setSelectedPath(created)
      }
      setPendingInput(null)
    },
    [pendingInput, ops]
  )

  const cancelPendingInput = useCallback(() => setPendingInput(null), [])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`flex flex-col text-sm select-none ${className}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        // Right-click on empty tree space
        if (e.target === e.currentTarget) {
          openContextMenu(e, { type: 'background', path: null })
        }
      }}
    >
      <ExplorerHeader
        onNewFile={handleNewFileAtRoot}
        onNewFolder={handleNewFolderAtRoot}
        onRefresh={handleRefresh}
        onCollapseAll={handleCollapseAll}
      />

      <div
        className="flex-1 overflow-y-auto px-1 pt-1"
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            openContextMenu(e, { type: 'background', path: null })
          }
        }}
      >
        {/* Pending root-level new-item input */}
        {pendingInput &&
          pendingInput.kind !== 'rename' &&
          pendingInput.parentPath === null && (
            <TreeInlineInput
              initialValue=""
              isFile={pendingInput.kind === 'new-file'}
              depth={0}
              onCommit={commitPendingInput}
              onCancel={cancelPendingInput}
            />
          )}

        {files.length === 0 && !pendingInput ? (
          <div className="p-4 text-sm text-[var(--foreground)]/40">
            No files loaded
          </div>
        ) : (
          files.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              activeFile={activeFile}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              loadingMap={loadingMap}
              onFileClick={handleFileClick}
              onContextMenu={openContextMenu}
              pendingInput={pendingInput}
              onCommitInput={commitPendingInput}
              onCancelInput={cancelPendingInput}
              clipboardPath={
                clipboard?.operation === 'cut' ? clipboard.path : null
              }
              expandedPaths={expandedPaths}
              onToggleExpanded={toggleExpanded}
            />
          ))
        )}
      </div>

      {contextMenu && (
        <TreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetType={contextMenu.targetType}
          canPaste={clipboard !== null}
          onNewFile={() => {
            const parent =
              contextMenu.targetType === 'directory'
                ? contextMenu.targetPath
                : resolveCreateParent(contextMenu.targetPath)
            setPendingInput({ kind: 'new-file', parentPath: parent })
          }}
          onNewFolder={() => {
            const parent =
              contextMenu.targetType === 'directory'
                ? contextMenu.targetPath
                : resolveCreateParent(contextMenu.targetPath)
            setPendingInput({ kind: 'new-folder', parentPath: parent })
          }}
          onRename={() => {
            if (contextMenu.targetPath) {
              setPendingInput({ kind: 'rename', path: contextMenu.targetPath })
            }
          }}
          onDelete={() => {
            if (contextMenu.targetPath) {
              if (confirm(`Delete "${contextMenu.targetPath}"?`)) {
                ops.deleteNode(contextMenu.targetPath)
                setSelectedPath(null)
              }
            }
          }}
          onCut={() => {
            if (contextMenu.targetPath) ops.cut(contextMenu.targetPath)
          }}
          onCopy={() => {
            if (contextMenu.targetPath) ops.copy(contextMenu.targetPath)
          }}
          onPaste={() => {
            const dest =
              contextMenu.targetType === 'directory'
                ? contextMenu.targetPath
                : resolveCreateParent(contextMenu.targetPath)
            ops.paste(dest)
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
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

// Given a "selected" path in the tree, figure out which folder should
// receive a new child. For directories, the selection IS the parent.
// For files, use their parent folder. For null, use the root.
function resolveCreateParent(selectedPath: string | null): string | null {
  if (!selectedPath) return null
  const store = useEditorStore.getState()
  const node = store.findNode(selectedPath)
  if (node?.type === 'directory') return node.path
  const slash = selectedPath.lastIndexOf('/')
  return slash > 0 ? selectedPath.slice(0, slash) : null
}

// ── Recursive tree node ──
interface TreeNodeProps {
  node: FileNode
  depth: number
  activeFile: string | null
  selectedPath: string | null
  onSelect: (path: string) => void
  loadingMap: LoadingMap
  onFileClick: (path: string, language: string, content: string, sha: string) => void
  onContextMenu: (
    e: React.MouseEvent,
    target: { type: 'file' | 'directory' | 'background'; path: string | null }
  ) => void
  pendingInput: PendingInput | null
  onCommitInput: (value: string) => void
  onCancelInput: () => void
  clipboardPath: string | null
  expandedPaths: Set<string>
  onToggleExpanded: (path: string) => void
}

function TreeNode({
  node,
  depth,
  activeFile,
  selectedPath,
  onSelect,
  loadingMap,
  onFileClick,
  onContextMenu,
  pendingInput,
  onCommitInput,
  onCancelInput,
  clipboardPath,
  expandedPaths,
  onToggleExpanded,
}: TreeNodeProps) {
  const isExpanded =
    node.type === 'directory' && expandedPaths.has(node.path)

  const handleClick = useCallback(() => {
    onSelect(node.path)
    if (node.type === 'directory') {
      onToggleExpanded(node.path)
    } else {
      void onFileClick(node.path, node.language ?? 'plaintext', '', '')
    }
  }, [node, onFileClick, onSelect, onToggleExpanded])

  const isLoading = node.type === 'file' && loadingMap[node.path]
  const isActive = node.type === 'file' && node.path === activeFile
  const isSelected = node.path === selectedPath
  const isCut =
    clipboardPath !== null &&
    (node.path === clipboardPath || node.path.startsWith(clipboardPath + '/'))

  // Is this node currently being renamed?
  const isRenaming =
    pendingInput?.kind === 'rename' && pendingInput.path === node.path

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

  if (isRenaming) {
    return (
      <TreeInlineInput
        initialValue={node.name}
        isFile={node.type === 'file'}
        depth={depth}
        onCommit={onCommitInput}
        onCancel={onCancelInput}
        iconSlot={
          <>
            {node.type === 'directory' ? (
              <Chevron className="h-3.5 w-3.5 shrink-0 opacity-60" />
            ) : (
              <span className="w-3.5 shrink-0" aria-hidden />
            )}
            <Icon
              className="h-4 w-4 shrink-0"
              style={{ color }}
              strokeWidth={1.75}
            />
          </>
        }
      />
    )
  }

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={(e) =>
          onContextMenu(e, { type: node.type, path: node.path })
        }
        disabled={isLoading}
        className={`
          w-full flex items-center gap-1 px-1.5 py-1 rounded-md text-left
          transition-colors duration-100 cursor-pointer
          ${
            isActive
              ? 'bg-primary/15 text-primary'
              : isSelected
                ? 'bg-[var(--foreground)]/10 text-[var(--foreground)]'
                : 'text-[var(--foreground)]/75 hover:bg-[var(--foreground)]/10 hover:text-[var(--foreground)]'
          }
          ${isLoading ? 'opacity-60 cursor-wait' : ''}
          ${isCut ? 'opacity-50' : ''}
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

        {/* Name (+ new badge if locally added) */}
        <span className="truncate flex items-center gap-1.5">
          {node.name}
          {node.isNew && (
            <span
              className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400/80"
              title="Added locally — will be committed on next Commit"
            >
              new
            </span>
          )}
        </span>

        {isLoading && (
          <span className="ml-auto text-[10px] opacity-60">loading</span>
        )}
      </button>

      {/* Children (recursive) */}
      {node.type === 'directory' && isExpanded && (
        <div>
          {/* Pending new-item input inside this directory */}
          {pendingInput &&
            pendingInput.kind !== 'rename' &&
            pendingInput.parentPath === node.path && (
              <TreeInlineInput
                initialValue=""
                isFile={pendingInput.kind === 'new-file'}
                depth={depth + 1}
                onCommit={onCommitInput}
                onCancel={onCancelInput}
              />
            )}
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              selectedPath={selectedPath}
              onSelect={onSelect}
              loadingMap={loadingMap}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              pendingInput={pendingInput}
              onCommitInput={onCommitInput}
              onCancelInput={onCancelInput}
              clipboardPath={clipboardPath}
              expandedPaths={expandedPaths}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  )
}
