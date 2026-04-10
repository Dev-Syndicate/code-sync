'use client'

import { useCallback, useState } from 'react'
import type * as Y from 'yjs'
import { useEditorStore } from '@/store/editorStore'

interface UseDraftRevertOptions {
  sessionId: string
  ydoc: Y.Doc | null
}

interface DraftPayload {
  path:        string
  content:     string
  originalSha: string
  uploadedBy:  string
  uploadedAt:  string
}

type RevertStatus = 'idle' | 'loading' | 'success' | 'error'

interface UseDraftRevertReturn {
  revertStatus: RevertStatus
  revertError:  string | null
  /** How many open files were rewritten on the last successful revert. */
  lastRevertCount: number
  revertToLastSave: () => Promise<void>
}

/**
 * Save Revert — rolls every currently-open file back to its last saved draft,
 * collaboratively (every peer in the session sees the revert).
 *
 * How it works:
 *
 * 1. Fetch every draft for this session from Firebase Storage via
 *    GET /api/sessions/[id]/drafts. This returns the last Save snapshot for
 *    each file that was ever saved in the session.
 * 2. For each currently-open tab that has a matching draft, atomically
 *    replace the file's Y.Text contents inside a single doc.transact() —
 *    `delete(0, length); insert(0, draftContent)`. Because the Y.Text is a
 *    shared CRDT, this change replicates to every peer, so Bob's editor
 *    snaps back at the same moment Alice's does.
 * 3. Clear the dirty flag for each reverted tab. The content now matches
 *    the draft baseline, so the next edit will correctly flip it back to
 *    dirty.
 *
 * Files that are dirty but have no saved draft (user typed and never hit
 * Save) are left alone — there's nothing to revert to. We surface that in
 * `lastRevertCount` so the UI can show "reverted N of M files" if it wants.
 *
 * Edge case: files that are open but not dirty are also re-written if a
 * draft exists. This is correct — the user clicked Revert, they want every
 * open file at the last-save state, regardless of whether they've touched
 * it. This keeps behavior predictable ("revert takes me to my last save,
 * full stop").
 */
export function useDraftRevert({
  sessionId,
  ydoc,
}: UseDraftRevertOptions): UseDraftRevertReturn {
  const [revertStatus, setRevertStatus] = useState<RevertStatus>('idle')
  const [revertError, setRevertError] = useState<string | null>(null)
  const [lastRevertCount, setLastRevertCount] = useState(0)

  const revertToLastSave = useCallback(async () => {
    if (!ydoc) {
      setRevertError('Collaboration is not ready yet.')
      setRevertStatus('error')
      return
    }

    setRevertStatus('loading')
    setRevertError(null)

    try {
      const res = await fetch(`/api/sessions/${sessionId}/drafts`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Failed to load drafts (${res.status})`)
      }

      const json = await res.json()
      const drafts: DraftPayload[] = json?.data?.drafts ?? []

      if (drafts.length === 0) {
        setRevertError('No saved drafts to revert to.')
        setRevertStatus('error')
        return
      }

      const draftByPath = new Map(drafts.map((d) => [d.path, d]))
      const { tabs, markDirty } = useEditorStore.getState()

      // Collect (path, content) pairs for open files that have a draft.
      // Files open but never saved are skipped. Files saved but not
      // currently open stay on disk — they'll be re-seeded on next open.
      const toRewrite: Array<{ path: string; content: string }> = []
      for (const tab of tabs) {
        const draft = draftByPath.get(tab.path)
        if (draft) {
          toRewrite.push({ path: tab.path, content: draft.content })
        }
      }

      if (toRewrite.length === 0) {
        setRevertError('No draft found for any currently-open file.')
        setRevertStatus('error')
        return
      }

      // One Yjs transaction across every affected file — peers see a single
      // atomic revert, not N individual edits flashing across the screen.
      ydoc.transact(() => {
        for (const { path, content } of toRewrite) {
          const ytext = ydoc.getText(`file:${path}`)
          if (ytext.length > 0) ytext.delete(0, ytext.length)
          if (content.length > 0) ytext.insert(0, content)
        }
      })

      // Reset dirty state for every rewritten tab. The useMonacoYjsBinding
      // observer will mirror the Y.Text change into tab.content already,
      // but it calls updateFileContent which re-marks dirty. We override
      // that here after the transaction settles.
      //
      // We also do it in a microtask to let the ytext observers fire first,
      // so markDirty wins the race.
      queueMicrotask(() => {
        for (const { path } of toRewrite) {
          markDirty(path, false)
        }
      })

      setLastRevertCount(toRewrite.length)
      setRevertStatus('success')
    } catch (err) {
      console.error('[useDraftRevert] revert failed:', err)
      setRevertError(err instanceof Error ? err.message : 'Failed to revert to last save.')
      setRevertStatus('error')
    }
  }, [sessionId, ydoc])

  return { revertStatus, revertError, lastRevertCount, revertToLastSave }
}
