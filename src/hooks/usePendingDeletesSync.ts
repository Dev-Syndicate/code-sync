'use client'

// usePendingDeletesSync
// ─────────────────────
// Keeps the per-session pendingDeletes list persistent across reloads by:
//
//   1. Fetching the stored list on mount and merging it into editorStore.
//      After merging, we also prune the file tree to remove any paths that
//      were already pending-delete (so the Explorer reflects the deletion
//      the moment the page opens, not only after the user acts on it).
//
//   2. Watching the store and pushing updates to /api/sessions/[id]/pending-deletes
//      whenever the list changes. The PUT is debounced (300ms) so rapid
//      deletions collapse to a single write.
//
// This hook is mounted once from the session page. It's a side-effect hook
// with no return value.

import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editorStore'

interface Options {
  sessionId: string
  /** True once the initial file tree has been seeded from /api/sessions/[id]. */
  treeReady: boolean
}

export function usePendingDeletesSync({ sessionId, treeReady }: Options) {
  const pendingDeletes = useEditorStore((s) => s.pendingDeletes)
  const hasSeeded = useRef(false)

  // ── Initial fetch: seed the store + prune the tree ─────────────────────
  useEffect(() => {
    if (!sessionId || !treeReady) return
    if (hasSeeded.current) return
    hasSeeded.current = true

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/pending-deletes`,
          { credentials: 'same-origin', cache: 'no-store' }
        )
        if (!res.ok) return
        const json = await res.json()
        const deletes: string[] = json?.data?.deletes ?? []
        if (cancelled || deletes.length === 0) return

        const store = useEditorStore.getState()
        store.setPendingDeletes(deletes)

        // Prune the freshly-built tree so already-deleted paths disappear.
        // We call store.deleteNode for each path — it handles the tree and
        // any open tabs. This happens before the user sees anything because
        // the Explorer is rendered from the same store snapshot.
        for (const path of deletes) {
          // Skip if the path no longer exists in the tree (e.g. someone
          // else committed the deletion on GitHub and we re-fetched).
          if (store.findNode(path)) {
            store.deleteNode(path)
          }
        }
        // `deleteNode` also clears pendingDeletes for locally-created
        // files, but we re-seed them here to keep GitHub-sourced deletes
        // in the list. setPendingDeletes already did that above, but
        // deleteNode calls can erode it — re-apply.
        useEditorStore.getState().setPendingDeletes(deletes)
      } catch (err) {
        console.error(
          '[usePendingDeletesSync] initial fetch failed:',
          err
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, treeReady])

  // ── Debounced PUT on change ────────────────────────────────────────────
  // We skip the very first render so the mount-time "load from server +
  // write it back" round-trip doesn't fire a useless PUT.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstChange = useRef(true)
  useEffect(() => {
    if (!sessionId) return
    if (!hasSeeded.current) return
    if (firstChange.current) {
      firstChange.current = false
      return
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      void fetch(`/api/sessions/${sessionId}/pending-deletes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ deletes: pendingDeletes }),
      }).catch((err) => {
        console.error('[usePendingDeletesSync] PUT failed:', err)
      })
    }, 300)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [sessionId, pendingDeletes])
}
