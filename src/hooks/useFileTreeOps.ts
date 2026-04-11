'use client'

// useFileTreeOps
// ──────────────
// High-level Explorer operations that need to touch BOTH the editor store
// (tabs, tree, clipboard) AND the Yjs document (per-file Y.Text objects
// keyed `file:<path>`). Keeping these in a hook — rather than in
// editorStore directly — means the store stays Yjs-agnostic and this hook
// is the only place that knows the `file:` key convention, which is
// already owned by useCollaboration / useMonacoYjsBinding.
//
// Phase 1 scope: local-only. No shared file-tree Yjs structure. Other
// peers only see changes to files that already exist in the GitHub
// snapshot (because those have a shared Y.Text). Newly-created files are
// local until the user commits; rename/move of existing files correctly
// re-keys the Y.Text so every peer sees the new path the moment the
// transaction commits (peers will still have the old tree client-side,
// though — that's the Phase 2 shared-tree problem).

import { useCallback } from 'react'
import type * as Y from 'yjs'
import { useEditorStore, type FileNode } from '@/store/editorStore'
import {
  writeSharedEntry,
  deleteSharedEntry,
  renameSharedEntries,
} from './useSharedFileTree'

interface UseFileTreeOpsOptions {
  ydoc: Y.Doc | null
}

interface UseFileTreeOpsReturn {
  createFile: (parentPath: string | null, name: string) => string | null
  createFolder: (parentPath: string | null, name: string) => string | null
  renameNode: (path: string, newName: string) => string | null
  deleteNode: (path: string) => void
  cut: (path: string) => void
  copy: (path: string) => void
  paste: (destParentPath: string | null) => string | null
  canPaste: () => boolean
}

// Generate a collision-free name by appending " (copy)", " (copy 2)", etc.
// Matches how Finder / VS Code pick a paste destination name.
function pickNonCollidingName(
  desiredName: string,
  siblings: FileNode[]
): string {
  const existing = new Set(siblings.map((s) => s.name))
  if (!existing.has(desiredName)) return desiredName

  const dotIdx = desiredName.lastIndexOf('.')
  const base = dotIdx > 0 ? desiredName.slice(0, dotIdx) : desiredName
  const ext = dotIdx > 0 ? desiredName.slice(dotIdx) : ''

  const firstTry = `${base} (copy)${ext}`
  if (!existing.has(firstTry)) return firstTry

  let i = 2
  while (true) {
    const candidate = `${base} (copy ${i})${ext}`
    if (!existing.has(candidate)) return candidate
    i += 1
  }
}

// Read the current content of a file from Yjs if it has a Y.Text, else
// fall back to the tab content, else empty.
function readFileContent(ydoc: Y.Doc | null, path: string): string {
  if (ydoc) {
    try {
      const ytext = ydoc.getText(`file:${path}`)
      if (ytext.length > 0) return ytext.toString()
    } catch {
      /* ignore */
    }
  }
  const tab = useEditorStore.getState().tabs.find((t) => t.path === path)
  return tab?.content ?? ''
}

// Seed a Y.Text at `path` with `content`, inside a single transaction so
// peers see it as one atomic change.
function writeFileContent(
  ydoc: Y.Doc | null,
  path: string,
  content: string
): void {
  if (!ydoc) return
  ydoc.transact(() => {
    const ytext = ydoc.getText(`file:${path}`)
    if (ytext.length > 0) ytext.delete(0, ytext.length)
    if (content.length > 0) ytext.insert(0, content)
  }, 'file-tree-ops')
}

// Recursively enumerate every leaf (file) path inside a node. Used to
// copy/move entire directory subtrees.
function enumerateFiles(node: FileNode, acc: string[] = []): string[] {
  if (node.type === 'file') {
    acc.push(node.path)
  } else if (node.children) {
    for (const c of node.children) enumerateFiles(c, acc)
  }
  return acc
}

// Like enumerateFiles but keeps the isNew flag so callers can distinguish
// locally-created leaves from GitHub-sourced ones.
interface LeafMeta {
  path: string
  isNew: boolean
}
function enumerateFilesWithMeta(
  node: FileNode,
  acc: LeafMeta[] = []
): LeafMeta[] {
  if (node.type === 'file') {
    acc.push({ path: node.path, isNew: !!node.isNew })
  } else if (node.children) {
    for (const c of node.children) enumerateFilesWithMeta(c, acc)
  }
  return acc
}

export function useFileTreeOps(
  opts: UseFileTreeOpsOptions
): UseFileTreeOpsReturn {
  const { ydoc } = opts

  const createFile = useCallback(
    (parentPath: string | null, name: string): string | null => {
      const store = useEditorStore.getState()
      const fullPath = store.createFile(parentPath, name)
      if (!fullPath) return null
      // Seed the Y.Text so future peers that join the session see an
      // empty-but-present entry under the new key. Harmless if nobody
      // else has this file — they'll get it on next sync.
      writeFileContent(ydoc, fullPath, '')
      // Announce the new entry in the shared file-tree map so remote
      // peers see it in their Explorer even if they haven't opened it.
      if (ydoc) {
        const node = store.findNode(fullPath)
        writeSharedEntry(ydoc, fullPath, {
          type: 'file',
          language: node?.language,
        })
      }
      return fullPath
    },
    [ydoc]
  )

  const createFolder = useCallback(
    (parentPath: string | null, name: string): string | null => {
      const fullPath = useEditorStore.getState().createFolder(parentPath, name)
      if (!fullPath) return null
      if (ydoc) {
        writeSharedEntry(ydoc, fullPath, { type: 'directory' })
      }
      return fullPath
    },
    [ydoc]
  )

  const renameNode = useCallback(
    (path: string, newName: string): string | null => {
      const store = useEditorStore.getState()
      const node = store.findNode(path)
      if (!node) return null

      // Collect every leaf under the subtree. Snapshot content + isNew
      // BEFORE the rename — both because the Y.Text keys are about to
      // change AND because we need to know which leaves originated from
      // GitHub (so rename-as-move propagates as delete+add on commit).
      const leaves = enumerateFilesWithMeta(node)
      const snapshots = leaves.map((leaf) => ({
        oldPath: leaf.path,
        isNew: leaf.isNew,
        content: readFileContent(ydoc, leaf.path),
      }))

      const newPath = store.renameNode(path, newName)
      if (!newPath) return null

      // For every GitHub-sourced leaf inside the renamed subtree, the old
      // path needs to be deleted on GitHub. The renamed copy becomes a
      // brand-new blob at the new path (isNew is set by renameNode? — no,
      // renameNode preserves isNew=false, but since the new path has no
      // GitHub counterpart yet, the commit flow treats the dirty tab as an
      // upsert, which creates the blob at the new path. Combined with the
      // pending-delete of the old path, GitHub sees "delete old + add new"
      // in one commit — a git rename.)
      const s = useEditorStore.getState()
      for (const snap of snapshots) {
        if (!snap.isNew) {
          s.addPendingDelete(snap.oldPath)
        }
        // If the user had previously marked the NEW path for deletion
        // (edge case: delete foo.py, then rename bar.py → foo.py), cancel
        // that deletion because the path is about to be re-created.
        const newLeafPath = newPath + snap.oldPath.slice(path.length)
        s.removePendingDelete(newLeafPath)
      }

      // Re-seed the Y.Texts under the new keys inside a single transaction
      // so peers see one atomic rename. We also clear the old keys so
      // stale Y.Texts don't linger in the doc.
      //
      // Also mark the renamed tabs dirty so the commit flow picks them up.
      // (renameNode in the store preserves isDirty, but for a pure rename
      // the user hasn't touched the content — without the dirty flag, the
      // commit would send the delete but not the add, losing the file.)
      if (ydoc) {
        ydoc.transact(() => {
          for (const snap of snapshots) {
            const rewritten = newPath + snap.oldPath.slice(path.length)
            const newYText = ydoc.getText(`file:${rewritten}`)
            if (newYText.length > 0) newYText.delete(0, newYText.length)
            if (snap.content.length > 0) newYText.insert(0, snap.content)
            const oldYText = ydoc.getText(`file:${snap.oldPath}`)
            if (oldYText.length > 0) oldYText.delete(0, oldYText.length)
          }
        }, 'file-tree-ops')
      }

      // Mark renamed tabs dirty so commit includes them at the new path.
      const finalStore = useEditorStore.getState()
      for (const snap of snapshots) {
        const rewritten = newPath + snap.oldPath.slice(path.length)
        const tab = finalStore.tabs.find((t) => t.path === rewritten)
        if (tab) finalStore.markDirty(rewritten, true)
      }

      // Propagate the rename through the shared file-tree map. Renamed
      // GitHub leaves become "new blob at new path + delete at old path"
      // on the next commit, so for remote peers the new path needs to
      // appear in the shared map AND the (newly created) node under the
      // new path now has isNew=true in every peer's store. Meanwhile the
      // old-path shared-map entry (if any — only present when the leaf
      // was already isNew) must be removed.
      if (ydoc) {
        // Figure out which of the old paths were in the shared map.
        // isNew leaves were in the map; GitHub-sourced leaves were not.
        const renamePairs: Array<{ oldPath: string; newPath: string }> = []
        const newOnlyAdds: Array<{
          path: string
          entry: { type: 'file' | 'directory'; language?: string }
        }> = []
        for (const snap of snapshots) {
          const rewritten = newPath + snap.oldPath.slice(path.length)
          if (snap.isNew) {
            renamePairs.push({ oldPath: snap.oldPath, newPath: rewritten })
          } else {
            // GitHub-sourced leaf: the commit flow will create a new
            // blob at `rewritten`. For peers' Explorer to show the
            // new path immediately, add it as an isNew entry in the
            // shared map (which is what it effectively is now — the
            // new path has no GitHub counterpart yet).
            const node = finalStore.findNode(rewritten)
            newOnlyAdds.push({
              path: rewritten,
              entry: { type: 'file', language: node?.language },
            })
          }
        }
        // Also handle the renamed root itself if it's a directory that
        // was isNew — directories have their own shared-map entry.
        if (node.type === 'directory' && node.isNew) {
          renamePairs.push({ oldPath: path, newPath })
        }
        renameSharedEntries(ydoc, renamePairs)
        for (const add of newOnlyAdds) {
          writeSharedEntry(ydoc, add.path, add.entry)
        }
      }

      return newPath
    },
    [ydoc]
  )

  const deleteNode = useCallback(
    (path: string): void => {
      const store = useEditorStore.getState()
      const node = store.findNode(path)
      if (!node) return

      // Collect leaves with their isNew flag BEFORE calling the store
      // delete (which wipes the subtree). GitHub-sourced leaves get
      // queued as pending deletes; locally-created leaves don't need to
      // — they never existed on GitHub so deleting them is a pure
      // client-side cancel.
      const leaves = enumerateFilesWithMeta(node)

      store.deleteNode(path)

      const s = useEditorStore.getState()
      for (const leaf of leaves) {
        if (!leaf.isNew) {
          s.addPendingDelete(leaf.path)
        }
      }

      // Clear each leaf's Y.Text so other peers' bindings empty out.
      if (ydoc) {
        ydoc.transact(() => {
          for (const leaf of leaves) {
            const ytext = ydoc.getText(`file:${leaf.path}`)
            if (ytext.length > 0) ytext.delete(0, ytext.length)
          }
        }, 'file-tree-ops')
        // Remove the subtree from the shared file-tree map so remote
        // peers drop the entries from their Explorer. GitHub-sourced
        // entries aren't in the map, so this is a no-op for them —
        // their deletion still flows through pendingDeletes.
        deleteSharedEntry(ydoc, path)
      }
    },
    [ydoc]
  )

  const cut = useCallback((path: string) => {
    const store = useEditorStore.getState()
    const node = store.findNode(path)
    if (!node) return
    store.setClipboard({ operation: 'cut', path, type: node.type })
  }, [])

  const copy = useCallback((path: string) => {
    const store = useEditorStore.getState()
    const node = store.findNode(path)
    if (!node) return
    store.setClipboard({ operation: 'copy', path, type: node.type })
  }, [])

  const canPaste = useCallback(() => {
    return useEditorStore.getState().clipboard !== null
  }, [])

  // Paste — the most complex op. Three cases:
  //   1. Cut a file → rename it (reuses renameNode flow above, which
  //      already moves the Y.Text). Source gets deleted from the tree
  //      because renameNode mutates in place.
  //   2. Copy a file → create a new file at the destination, seed its
  //      Y.Text from the source's current content, mark it isNew/dirty.
  //   3. Cut/copy a directory → recurse: create matching folder, then
  //      recursively paste each child file. Rename semantics for cut
  //      dirs are handled by renameNode because a subtree move is
  //      just a rename of the root.
  const paste = useCallback(
    (destParentPath: string | null): string | null => {
      const store = useEditorStore.getState()
      const entry = store.clipboard
      if (!entry) return null

      const src = store.findNode(entry.path)
      if (!src) {
        // Clipboard is stale (source was deleted). Clear it.
        store.setClipboard(null)
        return null
      }

      // Can't paste a dir inside itself or its descendants.
      if (
        src.type === 'directory' &&
        destParentPath !== null &&
        (destParentPath === src.path ||
          destParentPath.startsWith(src.path + '/'))
      ) {
        return null
      }

      // Determine destination siblings to pick a non-colliding name.
      const destSiblings: FileNode[] = (() => {
        if (destParentPath === null) return store.files
        const parent = store.findNode(destParentPath)
        return parent?.children ?? []
      })()

      const finalName = pickNonCollidingName(src.name, destSiblings)

      if (entry.operation === 'cut') {
        // MOVE: rename the source to a new parent. This requires the
        // underlying store to support a cross-parent move. The current
        // renameNode only renames within the same parent, so we do it
        // manually: copy subtree to destination, then delete source.
        // That path already exists via the copy branch below, so we
        // reuse it and tack on a delete.
        const createdPath = pasteCopyRecursive(
          src,
          destParentPath,
          finalName,
          ydoc
        )
        if (!createdPath) return null
        // Remove the original. deleteNode handles closing tabs and
        // clearing Y.Text under the old path.
        useEditorStore.getState().deleteNode(entry.path)
        if (ydoc) {
          ydoc.transact(() => {
            for (const leaf of enumerateFiles(src)) {
              const ytext = ydoc.getText(`file:${leaf}`)
              if (ytext.length > 0) ytext.delete(0, ytext.length)
            }
          }, 'file-tree-ops')
        }
        // Cut is a one-shot: clear the clipboard after a successful paste.
        useEditorStore.getState().setClipboard(null)
        return createdPath
      }

      // COPY: duplicate subtree under the destination with a fresh name.
      return pasteCopyRecursive(src, destParentPath, finalName, ydoc)
    },
    [ydoc]
  )

  return {
    createFile,
    createFolder,
    renameNode,
    deleteNode,
    cut,
    copy,
    paste,
    canPaste,
  }
}

// Recursive copy: creates `src` under `destParentPath` with name
// `finalName`, returning the newly-created root path. For directories,
// walks children and recreates each leaf, seeding Y.Text from the
// corresponding source's current content.
function pasteCopyRecursive(
  src: FileNode,
  destParentPath: string | null,
  finalName: string,
  ydoc: Y.Doc | null
): string | null {
  const store = useEditorStore.getState()

  if (src.type === 'file') {
    const created = store.createFile(destParentPath, finalName)
    if (!created) return null
    // Seed the new file with the source's current live content.
    const content = readFileContent(ydoc, src.path)
    writeFileContent(ydoc, created, content)
    // Also update the tab we just opened so the Monaco model reflects
    // the pasted content before any Yjs binding settles.
    useEditorStore.getState().updateFileContent(created, content)
    // Announce in the shared map so peers see the pasted file.
    if (ydoc) {
      const node = useEditorStore.getState().findNode(created)
      writeSharedEntry(ydoc, created, {
        type: 'file',
        language: node?.language,
      })
    }
    return created
  }

  // Directory: create the folder, then recurse into children.
  const createdDir = store.createFolder(destParentPath, finalName)
  if (!createdDir) return null
  if (ydoc) {
    writeSharedEntry(ydoc, createdDir, { type: 'directory' })
  }

  for (const child of src.children ?? []) {
    // Children keep their own names (no collision possible because we
    // just created an empty folder).
    pasteCopyRecursive(child, createdDir, child.name, ydoc)
  }

  return createdDir
}
