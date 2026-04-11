'use client'

// useSharedFileTree
// ─────────────────
// Propagates Explorer-created files/folders across every peer in the
// session via a shared Y.Map inside the collaboration ydoc.
//
// Why a Y.Map (not nested Y.Map-of-Y.Maps): paths are the natural key for
// everything else we do (Y.Text is keyed `file:<path>`, pendingDeletes is
// a list of paths), so a flat Y.Map<path, TreeEntry> gives us O(1) lookup
// and trivially-serializable entries. Renames become delete+add under
// different keys, which also matches how Yjs observers report them.
//
// Scope: ONLY locally-created (isNew) files/folders go here. GitHub
// snapshot files are implicit — every peer gets them from the session
// doc at load time. Deletions of GitHub files are already synced via
// the pending-deletes server endpoint, so we don't duplicate them here.
// Deletions of isNew files are just a delete from this Y.Map.
//
// Reconciliation loop guard: observer callbacks apply changes to the
// editor store WITHOUT writing back to Y.Map. The write-back path is
// only triggered by the Explorer UI (useFileTreeOps), so the guard is
// a simple "apply-from-observer" flag.

import { useEffect, useRef } from 'react'
import type * as Y from 'yjs'
import { useEditorStore, type FileNode } from '@/store/editorStore'

const TREE_MAP_KEY = 'file-tree'
const TRANSACTION_ORIGIN = 'shared-file-tree'

export interface SharedTreeEntry {
  /** 'file' or 'directory'. */
  type: 'file' | 'directory'
  /** Monaco language id for files. Omitted for directories. */
  language?: string
}

interface Options {
  ydoc: Y.Doc | null
  /** Gate observer until the initial GitHub tree has been loaded into the
   *  store — otherwise we'd race the server fetch and double-insert. */
  treeReady: boolean
}

/**
 * Return the shared Y.Map for file-tree entries from a ydoc. Safe to call
 * repeatedly — Yjs returns the same map instance for a given key.
 */
export function getSharedTreeMap(
  ydoc: Y.Doc
): Y.Map<SharedTreeEntry> {
  return ydoc.getMap<SharedTreeEntry>(TREE_MAP_KEY)
}

/**
 * Write an entry into the shared tree. Use the `TRANSACTION_ORIGIN` so
 * the observer can ignore its own echoes.
 */
export function writeSharedEntry(
  ydoc: Y.Doc,
  path: string,
  entry: SharedTreeEntry
): void {
  const map = getSharedTreeMap(ydoc)
  ydoc.transact(() => {
    map.set(path, entry)
  }, TRANSACTION_ORIGIN)
}

/**
 * Remove an entry (and every descendant, for directories) from the
 * shared tree. Safe to call with a path that isn't present.
 */
export function deleteSharedEntry(ydoc: Y.Doc, path: string): void {
  const map = getSharedTreeMap(ydoc)
  ydoc.transact(() => {
    // Collect keys under this path (the node itself + any descendants)
    // before mutating, since deleting while iterating would be messy.
    const toDelete: string[] = []
    for (const key of map.keys()) {
      if (key === path || key.startsWith(path + '/')) {
        toDelete.push(key)
      }
    }
    for (const key of toDelete) map.delete(key)
  }, TRANSACTION_ORIGIN)
}

/**
 * Re-key an entry (rename/move). `pathMap` is a list of {oldPath,newPath}
 * pairs covering every leaf + directory inside the renamed subtree. All
 * mutations happen inside one transaction so peers see a single update.
 */
export function renameSharedEntries(
  ydoc: Y.Doc,
  pairs: Array<{ oldPath: string; newPath: string }>
): void {
  if (pairs.length === 0) return
  const map = getSharedTreeMap(ydoc)
  ydoc.transact(() => {
    for (const { oldPath, newPath } of pairs) {
      const entry = map.get(oldPath)
      if (!entry) continue
      map.delete(oldPath)
      map.set(newPath, entry)
    }
  }, TRANSACTION_ORIGIN)
}

/**
 * Collect every isNew node (files and directories) from the local tree,
 * flattened to a list of {path, entry} pairs ready to seed the shared map.
 */
function collectIsNewEntries(
  nodes: FileNode[]
): Array<{ path: string; entry: SharedTreeEntry }> {
  const out: Array<{ path: string; entry: SharedTreeEntry }> = []
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (n.isNew) {
        out.push({
          path: n.path,
          entry:
            n.type === 'file'
              ? { type: 'file', language: n.language }
              : { type: 'directory' },
        })
      }
      if (n.type === 'directory' && n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export function useSharedFileTree({ ydoc, treeReady }: Options): void {
  // We only want the seed-from-local step to run once per ydoc. After that,
  // every mutation flows through writeSharedEntry / useFileTreeOps.
  const seededFor = useRef<Y.Doc | null>(null)

  useEffect(() => {
    if (!ydoc || !treeReady) return

    const map = getSharedTreeMap(ydoc)

    // ── Seed phase ────────────────────────────────────────────────────
    // If this client already has locally-created entries in its store
    // (because the user created files BEFORE a peer joined), push them
    // into the shared map now so the peer sees them. Doing this inside
    // the transaction origin guard prevents the observer from echoing.
    if (seededFor.current !== ydoc) {
      seededFor.current = ydoc
      const localEntries = collectIsNewEntries(
        useEditorStore.getState().files
      )
      if (localEntries.length > 0) {
        ydoc.transact(() => {
          for (const { path, entry } of localEntries) {
            if (!map.has(path)) map.set(path, entry)
          }
        }, TRANSACTION_ORIGIN)
      }

      // Apply any entries that are already in the shared map (e.g. we
      // joined a session where another peer has already created files).
      // We iterate in path-length order so parent directories land
      // before their children — createFile/createFolder expect the
      // parent to exist in the store's tree.
      const existing: Array<{ path: string; entry: SharedTreeEntry }> = []
      map.forEach((entry, path) => {
        existing.push({ path, entry })
      })
      existing.sort((a, b) => a.path.length - b.path.length)
      applyEntriesToStore(existing)
    }

    // ── Observer ──────────────────────────────────────────────────────
    // Remote additions/removals land here. We ignore our own writes by
    // checking the transaction origin.
    const observer = (
      event: Y.YMapEvent<SharedTreeEntry>,
      tx: Y.Transaction
    ) => {
      if (tx.origin === TRANSACTION_ORIGIN) return

      // Collect additions (sorted parent-first) and removals.
      const additions: Array<{ path: string; entry: SharedTreeEntry }> = []
      const removals: string[] = []

      event.changes.keys.forEach((change, path) => {
        if (change.action === 'add' || change.action === 'update') {
          const entry = map.get(path)
          if (entry) additions.push({ path, entry })
        } else if (change.action === 'delete') {
          removals.push(path)
        }
      })

      // Apply removals first (rename = delete+add; removing the old
      // path first avoids a transient name collision on the add).
      for (const path of removals) {
        const store = useEditorStore.getState()
        if (store.findNode(path)) {
          store.deleteNode(path)
        }
      }

      additions.sort((a, b) => a.path.length - b.path.length)
      applyEntriesToStore(additions)
    }

    map.observe(observer)
    return () => {
      map.unobserve(observer)
    }
  }, [ydoc, treeReady])
}

// Apply a list of shared entries to the editor store. Uses createFile /
// createFolder so tabs/sort/collision handling matches what the Explorer
// UI would do. Silently skips entries whose parent directory isn't
// present yet — the caller should have sorted parent-first.
function applyEntriesToStore(
  entries: Array<{ path: string; entry: SharedTreeEntry }>
): void {
  const store = useEditorStore.getState()
  for (const { path, entry } of entries) {
    if (store.findNode(path)) continue // already present

    const slash = path.lastIndexOf('/')
    const parentPath = slash > 0 ? path.slice(0, slash) : null
    const name = slash > 0 ? path.slice(slash + 1) : path

    // If parent is specified but not present in the store's tree, skip —
    // it will arrive on a subsequent observer tick once its own entry is
    // applied. (Also covers the case where a peer creates a file inside
    // a GitHub-sourced directory that already exists locally.)
    if (parentPath !== null && !store.findNode(parentPath)) {
      // Parent could be a GitHub-sourced directory that DOES exist —
      // findNode handles that. If we get here, the parent is genuinely
      // missing, so we drop this entry. It's a best-effort propagation.
      continue
    }

    useEditorStore.getState().insertRemoteNode(parentPath, {
      name,
      type: entry.type,
      language: entry.language,
    })
  }
}
