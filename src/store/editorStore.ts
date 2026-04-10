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
  /**
   * True if this node was created locally in the Explorer and has no
   * counterpart on GitHub yet. The Explorer UI uses this to show a "new"
   * badge and the commit flow sends these files with no original SHA.
   */
  isNew?: boolean
}

// ── Clipboard state for cut/copy/paste in the Explorer ──
export interface FileClipboardEntry {
  operation: 'cut' | 'copy'
  path: string
  /** 'file' or 'directory' — needed so paste can duplicate subtrees. */
  type: 'file' | 'directory'
}

// Extension guessed → Monaco language id. Matches what the session's
// initial file list uses, so the left sidebar icons pick the right color.
const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  swift: 'swift',
  kt: 'kotlin',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  md: 'markdown',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
}

function guessLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_LANGUAGE[ext] ?? 'plaintext'
}

// ── Result shape for mergeRefreshedTree ───────────────────────────────────
export interface RefreshMergeResult {
  /** Newly-seen file paths that weren't in the old tree. */
  addedFiles: string[]
  /** Paths removed from GitHub that had no unsaved edits (closed quietly). */
  removedFiles: string[]
  /** Paths removed from GitHub that had a dirty tab — we kept the tab
   *  and promoted the tree node to isNew so the work survives. */
  survivedAsNew: string[]
  /** Paths where the user has a dirty tab AND GitHub's SHA moved
   *  forward. Content is left alone; the caller should warn the user
   *  that committing will overwrite the newer version. */
  staleDirtyFiles: string[]
  /** Paths where a clean (non-dirty) tab's originalSha was bumped to
   *  match GitHub's new SHA. Primarily for debugging/telemetry. */
  updatedCleanTabs: string[]
}

// ── Editor Store State ──
interface EditorState {
  // Tab management
  tabs: EditorTab[]
  activeFile: string | null

  // File tree
  files: FileNode[]

  /**
   * Paths the user deleted (or renamed away from) that existed on GitHub
   * at session creation time. On the next commit we send these to the
   * server as `deletes: string[]`, which turns them into `sha: null` tree
   * entries — GitHub's way of removing a path from the tree.
   *
   * Locally-created files (isNew) do NOT go here — they never existed on
   * GitHub, so "delete" just means "remove from local state."
   */
  pendingDeletes: string[]

  // In-app clipboard for Explorer cut/copy/paste. Null when nothing copied.
  clipboard: FileClipboardEntry | null

  // Settings
  settings: EditorSettings

  // Actions — Tab management
  openFile: (
    path: string,
    language: string,
    content: string,
    sha: string | null
  ) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  markDirty: (path: string, dirty: boolean) => void

  // Actions — File tree
  setFiles: (files: FileNode[]) => void

  /**
   * Create a new empty file in the tree under `parentPath` (null → root).
   * Opens it in a tab immediately and flags it as dirty with originalSha=null.
   * Returns the full path of the created file, or null on name conflict.
   */
  createFile: (parentPath: string | null, name: string) => string | null
  /**
   * Create a new empty folder under `parentPath` (null → root).
   * Returns the full path of the created folder, or null on name conflict.
   */
  createFolder: (parentPath: string | null, name: string) => string | null
  /**
   * Rename a file or folder. Updates the tab + activeFile if the renamed
   * node (or an ancestor of the active file) was renamed. Returns the new
   * path, or null on name conflict or if the source doesn't exist.
   *
   * NOTE: caller must also re-key any Y.Text attached to renamed files,
   * since this store doesn't know about Yjs. See useFileTreeOps.
   */
  renameNode: (path: string, newName: string) => string | null
  /**
   * Delete a file or folder from the tree. Closes any tabs that point to
   * the deleted path (or its descendants for folders).
   */
  deleteNode: (path: string) => void

  // Actions — Clipboard
  setClipboard: (entry: FileClipboardEntry | null) => void

  // Actions — Pending deletes
  /** Record a path as pending-delete. No-op if already recorded. */
  addPendingDelete: (path: string) => void
  /** Remove a path from the pending-delete list (e.g. if the user
   *  creates a new file at that path, we should cancel the deletion). */
  removePendingDelete: (path: string) => void
  /** Clear every pending delete — called after a successful commit. */
  clearPendingDeletes: () => void
  /** Replace the pending-delete list wholesale (used by draft restore). */
  setPendingDeletes: (paths: string[]) => void

  // Actions — Refresh from GitHub
  /**
   * Merge a fresh GitHub tree snapshot into the local state. Returns a
   * structured diff so the caller can emit toasts:
   *
   *   addedFiles      — files that appeared on GitHub since the snapshot
   *   removedFiles    — files gone from GitHub (closed any clean tabs)
   *   survivedAsNew   — files gone from GitHub whose dirty tab we kept
   *                     (promoted to isNew so the user's work survives)
   *   staleDirtyFiles — dirty tabs whose GitHub SHA has moved forward
   *                     (content untouched; caller warns user)
   *   updatedCleanTabs— clean tabs whose originalSha we bumped to the
   *                     new value so the commit-time conflict check
   *                     correctly flags them if the user somehow edits
   *                     them without re-opening
   */
  mergeRefreshedTree: (
    refreshed: Array<{ path: string; sha: string; language: string }>
  ) => RefreshMergeResult

  // Actions — Settings
  updateSettings: (settings: Partial<EditorSettings>) => void

  // Computed (exposed as functions per integration contract)
  getDirtyFiles: () => EditorTab[]
  getFileContent: (path: string) => string | undefined
  /** Find a node by full path (null if not found). */
  findNode: (path: string) => FileNode | null
}

// ── Pure tree helpers ─────────────────────────────────────────────────────
function findNodeIn(nodes: FileNode[], path: string): FileNode | null {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.type === 'directory' && n.children) {
      const hit = findNodeIn(n.children, path)
      if (hit) return hit
    }
  }
  return null
}

// Returns a new tree with `newNode` inserted under `parentPath`. If
// `parentPath` is null, inserts at root. Returns null on name collision
// with an existing sibling.
function insertNode(
  nodes: FileNode[],
  parentPath: string | null,
  newNode: FileNode
): FileNode[] | null {
  if (parentPath === null) {
    if (nodes.some((n) => n.name === newNode.name)) return null
    return sortNodes([...nodes, newNode])
  }

  let mutated = false
  let collision = false

  const walk = (list: FileNode[]): FileNode[] => {
    return list.map((n) => {
      if (mutated || collision) return n
      if (n.path === parentPath && n.type === 'directory') {
        const children = n.children ?? []
        if (children.some((c) => c.name === newNode.name)) {
          collision = true
          return n
        }
        mutated = true
        return { ...n, children: sortNodes([...children, newNode]) }
      }
      if (n.type === 'directory' && n.children) {
        return { ...n, children: walk(n.children) }
      }
      return n
    })
  }

  const next = walk(nodes)
  if (collision || !mutated) return null
  return next
}

function removeNode(nodes: FileNode[], path: string): FileNode[] {
  const filtered: FileNode[] = []
  for (const n of nodes) {
    if (n.path === path) continue
    if (n.type === 'directory' && n.children) {
      filtered.push({ ...n, children: removeNode(n.children, path) })
    } else {
      filtered.push(n)
    }
  }
  return filtered
}

// Rename the node at `oldPath` to `newName`. Rewrites all descendant paths
// under it. Returns { tree, newPath } or null on collision / not found.
function renameNodeIn(
  nodes: FileNode[],
  oldPath: string,
  newName: string
): { tree: FileNode[]; newPath: string } | null {
  const parts = oldPath.split('/')
  const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null
  const newPath = parentPath ? `${parentPath}/${newName}` : newName

  // Check for collision among siblings at the same level.
  const siblings =
    parentPath === null
      ? nodes
      : findNodeIn(nodes, parentPath)?.children ?? []
  if (siblings.some((s) => s.path !== oldPath && s.name === newName)) {
    return null
  }

  let found = false
  const walk = (list: FileNode[]): FileNode[] =>
    list.map((n) => {
      if (n.path === oldPath) {
        found = true
        return rewriteSubtree(n, oldPath, newPath, newName)
      }
      if (n.type === 'directory' && n.children) {
        return { ...n, children: walk(n.children) }
      }
      return n
    })

  const next = walk(nodes)
  if (!found) return null
  return { tree: sortSiblingsAt(next, parentPath), newPath }
}

// Rewrite a subtree rooted at `node` so its own path becomes newPath and
// every descendant's path has oldPath replaced with newPath.
function rewriteSubtree(
  node: FileNode,
  oldPath: string,
  newPath: string,
  newName: string
): FileNode {
  if (node.path === oldPath) {
    const rewritten: FileNode = {
      ...node,
      name: newName,
      path: newPath,
      language:
        node.type === 'file' ? guessLanguage(newName) : node.language,
    }
    if (node.type === 'directory' && node.children) {
      rewritten.children = node.children.map((c) =>
        rewriteSubtree(c, oldPath, newPath, c.name)
      )
    }
    return rewritten
  }
  // Descendant: rewrite its path prefix.
  const rewrittenPath = newPath + node.path.slice(oldPath.length)
  const rewritten: FileNode = { ...node, path: rewrittenPath }
  if (node.type === 'directory' && node.children) {
    rewritten.children = node.children.map((c) =>
      rewriteSubtree(c, oldPath, newPath, c.name)
    )
  }
  return rewritten
}

// After a rename, re-sort the siblings at the mutated level so the renamed
// node lands in the right alphabetical spot.
function sortSiblingsAt(
  nodes: FileNode[],
  parentPath: string | null
): FileNode[] {
  if (parentPath === null) return sortNodes(nodes)
  return nodes.map((n) => {
    if (n.path === parentPath && n.type === 'directory' && n.children) {
      return { ...n, children: sortNodes(n.children) }
    }
    if (n.type === 'directory' && n.children) {
      return { ...n, children: sortSiblingsAt(n.children, parentPath) }
    }
    return n
  })
}

// Directories first, then files — VS Code Explorer ordering. Alphabetical
// within each group.
function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

// Is `path` equal to `ancestor` or nested underneath it?
function isDescendantOf(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(ancestor + '/')
}

// Walk the tree and return every file leaf (skipping directory nodes).
// Used by mergeRefreshedTree to diff the current state against GitHub.
function flattenLeaves(nodes: FileNode[], acc: FileNode[] = []): FileNode[] {
  for (const n of nodes) {
    if (n.type === 'file') {
      acc.push(n)
    } else if (n.children) {
      flattenLeaves(n.children, acc)
    }
  }
  return acc
}

// Walk the tree and return every node (file or directory) marked isNew,
// as a flat list of shallow-clones ready to be re-inserted into a fresh
// tree. For an isNew directory, we clone the whole subtree as-is so
// children come along for the ride.
function collectLocalOnlyNodes(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = []
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (n.isNew) {
        out.push(cloneSubtree(n))
        // Don't recurse into an isNew directory — we've already taken
        // the whole subtree.
        continue
      }
      if (n.type === 'directory' && n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function cloneSubtree(node: FileNode): FileNode {
  if (node.type === 'file') return { ...node }
  return {
    ...node,
    children: node.children?.map(cloneSubtree) ?? [],
  }
}

// Parent path of a node path. 'src/app/page.tsx' → 'src/app'. Returns
// null for root-level nodes.
function parentOf(path: string): string | null {
  const slash = path.lastIndexOf('/')
  return slash > 0 ? path.slice(0, slash) : null
}

// Minimal flat → nested tree builder used by mergeRefreshedTree. We
// can't import the client-side `@/lib/editor/buildFileTree` here because
// the store is also imported server-side-adjacent code paths; keeping
// this self-contained avoids a circular-dep risk.
function buildTreeFromFlat(
  flat: Array<{ path: string; language: string }>
): FileNode[] {
  const root: FileNode[] = []
  for (const file of flat) {
    const parts = file.path.split('/').filter(Boolean)
    let currentLevel = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLeaf = i === parts.length - 1
      let node = currentLevel.find((n) => n.name === part)
      if (!node) {
        node = isLeaf
          ? {
              name: part,
              path: file.path,
              type: 'file',
              language: file.language,
            }
          : {
              name: part,
              path: currentPath,
              type: 'directory',
              children: [],
            }
        currentLevel.push(node)
      }
      if (!isLeaf && node.type === 'directory' && node.children) {
        currentLevel = node.children
      }
    }
  }
  return sortNodesDeep(root)
}

function sortNodesDeep(nodes: FileNode[]): FileNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const n of nodes) {
    if (n.type === 'directory' && n.children) sortNodesDeep(n.children)
  }
  return nodes
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeFile: null,
  files: [],
  pendingDeletes: [],
  clipboard: null,
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

  createFile: (parentPath, name) => {
    const trimmed = name.trim()
    if (!trimmed || trimmed.includes('/')) return null

    const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed
    const language = guessLanguage(trimmed)
    const newNode: FileNode = {
      name: trimmed,
      path: fullPath,
      type: 'file',
      language,
      isNew: true,
    }

    const { files, tabs, pendingDeletes } = get()
    const nextTree = insertNode(files, parentPath, newNode)
    if (!nextTree) return null

    // Open immediately in a new tab, dirty + null SHA so the commit flow
    // treats it as a brand-new blob.
    const newTab: EditorTab = {
      path: fullPath,
      language,
      content: '',
      isActive: true,
      isDirty: true,
      originalSha: null,
    }

    // Edge case: user deleted foo.py then re-created foo.py. Cancel the
    // pending delete so the commit ends up as an update, not delete+add.
    const nextPendingDeletes = pendingDeletes.filter((p) => p !== fullPath)

    set({
      files: nextTree,
      tabs: [...tabs.map((t) => ({ ...t, isActive: false })), newTab],
      activeFile: fullPath,
      pendingDeletes: nextPendingDeletes,
    })
    return fullPath
  },

  createFolder: (parentPath, name) => {
    const trimmed = name.trim()
    if (!trimmed || trimmed.includes('/')) return null

    const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed
    const newNode: FileNode = {
      name: trimmed,
      path: fullPath,
      type: 'directory',
      children: [],
      isNew: true,
    }

    const nextTree = insertNode(get().files, parentPath, newNode)
    if (!nextTree) return null

    set({ files: nextTree })
    return fullPath
  },

  renameNode: (path, newName) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed.includes('/')) return null

    const { files, tabs, activeFile } = get()
    const result = renameNodeIn(files, path, trimmed)
    if (!result) return null

    const { tree, newPath } = result

    // Rewrite any open tabs whose path sits under the renamed subtree.
    // For a file rename, only one tab matches. For a folder rename, every
    // descendant tab has its prefix rewritten.
    const nextTabs: EditorTab[] = tabs.map((t) => {
      if (!isDescendantOf(t.path, path)) return t
      const rewritten = newPath + t.path.slice(path.length)
      return {
        ...t,
        path: rewritten,
        language:
          t.path === path ? guessLanguage(trimmed) : t.language,
      }
    })

    let nextActive = activeFile
    if (activeFile && isDescendantOf(activeFile, path)) {
      nextActive = newPath + activeFile.slice(path.length)
    }

    set({ files: tree, tabs: nextTabs, activeFile: nextActive })
    return newPath
  },

  deleteNode: (path) => {
    const { files, tabs, activeFile, clipboard } = get()

    // Close every tab that sits under the deleted subtree.
    const survivingTabs = tabs.filter((t) => !isDescendantOf(t.path, path))

    // If the active file was inside the deleted subtree, promote the last
    // surviving tab (if any).
    let nextActive = activeFile
    if (activeFile && isDescendantOf(activeFile, path)) {
      nextActive =
        survivingTabs.length > 0
          ? survivingTabs[survivingTabs.length - 1].path
          : null
    }

    // If the clipboard entry points into the deleted subtree, clear it.
    const nextClipboard =
      clipboard && isDescendantOf(clipboard.path, path) ? null : clipboard

    set({
      files: removeNode(files, path),
      tabs: survivingTabs.map((t) => ({
        ...t,
        isActive: t.path === nextActive,
      })),
      activeFile: nextActive,
      clipboard: nextClipboard,
    })
  },

  setClipboard: (entry) => set({ clipboard: entry }),

  addPendingDelete: (path) => {
    set((state) => {
      if (state.pendingDeletes.includes(path)) return state
      return { pendingDeletes: [...state.pendingDeletes, path] }
    })
  },

  removePendingDelete: (path) => {
    set((state) => ({
      pendingDeletes: state.pendingDeletes.filter((p) => p !== path),
    }))
  },

  clearPendingDeletes: () => set({ pendingDeletes: [] }),

  setPendingDeletes: (paths) => set({ pendingDeletes: [...paths] }),

  mergeRefreshedTree: (refreshed) => {
    const state = get()
    const { files, tabs, pendingDeletes } = state

    // Build a fast lookup of the fresh GitHub state by path.
    const refreshedByPath = new Map<
      string,
      { path: string; sha: string; language: string }
    >()
    for (const f of refreshed) refreshedByPath.set(f.path, f)

    // Flatten the current tree so we can diff it against the fresh list.
    const currentLeaves = flattenLeaves(files)
    const currentLeafByPath = new Map<string, FileNode>()
    for (const leaf of currentLeaves) currentLeafByPath.set(leaf.path, leaf)

    const addedFiles: string[] = []
    const removedFiles: string[] = []
    const survivedAsNew: string[] = []
    const staleDirtyFiles: string[] = []
    const updatedCleanTabs: string[] = []

    // ── 1. Detect additions: files on GitHub we don't know about ──
    for (const f of refreshed) {
      if (!currentLeafByPath.has(f.path)) {
        addedFiles.push(f.path)
      }
    }

    // ── 2. Detect removals: files we know about that GitHub no longer has.
    //       Skip locally-new files (they never existed on GitHub) and
    //       paths the user has already marked as pending-delete.
    const pendingDeletesSet = new Set(pendingDeletes)
    const survivedNewNodes: FileNode[] = []
    for (const leaf of currentLeaves) {
      if (refreshedByPath.has(leaf.path)) continue
      if (leaf.isNew) continue // locally-created, untouched
      if (pendingDeletesSet.has(leaf.path)) {
        // User had already queued this for deletion. GitHub now agrees
        // with us — the pending delete is no longer needed (it'll be a
        // no-op at commit time anyway).
        continue
      }

      const tab = tabs.find((t) => t.path === leaf.path)
      if (tab && tab.isDirty) {
        // Dirty tab, upstream delete → survive as isNew.
        survivedAsNew.push(leaf.path)
        survivedNewNodes.push({
          name: leaf.name,
          path: leaf.path,
          type: 'file',
          language: leaf.language,
          isNew: true,
        })
      } else {
        removedFiles.push(leaf.path)
      }
    }

    // ── 3. Detect moved-forward files: we know them, GitHub has them,
    //       but the SHA has changed.
    const updatedTabs: EditorTab[] = tabs.map((t) => {
      const fresh = refreshedByPath.get(t.path)
      if (!fresh) return t
      if (!t.originalSha) return t // locally-new, no SHA to compare
      if (fresh.sha === t.originalSha) return t // still in sync

      if (t.isDirty) {
        // Stale dirty: leave content alone, caller warns.
        staleDirtyFiles.push(t.path)
        return t
      }

      // Clean tab whose GitHub SHA moved. Bump originalSha so the
      // commit-time conflict check correctly detects that this tab is
      // based on the old version if the user somehow edits it without
      // re-opening. The next file-click will re-fetch actual content.
      updatedCleanTabs.push(t.path)
      return { ...t, originalSha: fresh.sha }
    })

    // ── 4. Rebuild the file tree from the refreshed list, then graft
    //       the locally-new and survived-as-new subtrees back in.
    //       We can't use buildFileTree here because that's in a
    //       different module; inline the flattening + tree construction.
    const nextTreeFlat = refreshed.map((f) => ({
      path: f.path,
      language: f.language,
    }))
    let nextTree = buildTreeFromFlat(nextTreeFlat)

    // Re-insert every locally-new file/folder that was in the old tree.
    // We walk the old tree and re-insert anything with isNew=true.
    const localOnlyNodes = collectLocalOnlyNodes(files)
    for (const localNode of localOnlyNodes) {
      const parentPath = parentOf(localNode.path)
      const inserted = insertNode(nextTree, parentPath, localNode)
      if (inserted) nextTree = inserted
      // Collision shouldn't happen (the refreshed tree wouldn't contain
      // a locally-new path), but if it does we silently drop and move on.
    }

    // Re-insert survived-as-new nodes for dirty tabs whose files got
    // deleted on GitHub.
    for (const node of survivedNewNodes) {
      const parentPath = parentOf(node.path)
      const inserted = insertNode(nextTree, parentPath, node)
      if (inserted) nextTree = inserted
    }

    // ── 5. Close any clean tabs whose files were removed. ──
    const removedSet = new Set(removedFiles)
    const nextTabsFiltered = updatedTabs.filter((t) => !removedSet.has(t.path))

    // If the active file was just removed, promote the last surviving
    // tab (if any).
    let nextActive = state.activeFile
    if (nextActive && removedSet.has(nextActive)) {
      nextActive =
        nextTabsFiltered.length > 0
          ? nextTabsFiltered[nextTabsFiltered.length - 1].path
          : null
    }

    // ── 6. Update tabs for survivedAsNew: flip their originalSha to null
    //       so they're treated as brand-new blobs on commit.
    const survivedSet = new Set(survivedAsNew)
    const nextTabs: EditorTab[] = nextTabsFiltered.map((t) => {
      if (!survivedSet.has(t.path)) {
        return { ...t, isActive: t.path === nextActive }
      }
      return {
        ...t,
        originalSha: null,
        isDirty: true,
        isActive: t.path === nextActive,
      }
    })

    set({
      files: nextTree,
      tabs: nextTabs,
      activeFile: nextActive,
      // Clean out pending-deletes that GitHub has already processed
      // (paths that no longer exist remotely).
      pendingDeletes: pendingDeletes.filter((p) => refreshedByPath.has(p)),
    })

    return {
      addedFiles,
      removedFiles,
      survivedAsNew,
      staleDirtyFiles,
      updatedCleanTabs,
    }
  },

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

  findNode: (path) => findNodeIn(get().files, path),
}))
