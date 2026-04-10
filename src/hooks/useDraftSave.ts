'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { useToastStore } from '@/store/toastStore'

interface UseDraftSaveOptions {
  sessionId: string
}

interface UseDraftSaveReturn {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: Date | null
  hasDirtyFiles: boolean
  save: () => Promise<void>
}

export function useDraftSave({ sessionId }: UseDraftSaveOptions): UseDraftSaveReturn {
  const getDirtyFiles = useEditorStore((s) => s.getDirtyFiles)
  const addToast = useToastStore((s) => s.addToast)

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // Derive hasDirtyFiles reactively by subscribing to tabs directly
  const hasDirtyFiles = useEditorStore((s) => s.tabs.some((t) => t.isDirty))

  // Reset 'saved' back to 'idle' after 3 seconds
  useEffect(() => {
    if (saveStatus !== 'saved') return
    const timer = setTimeout(() => setSaveStatus('idle'), 3000)
    return () => clearTimeout(timer)
  }, [saveStatus])

  const save = useCallback(async () => {
    const dirtyFiles = getDirtyFiles()
    if (dirtyFiles.length === 0) return

    setSaveStatus('saving')

    try {
      const res = await fetch(`/api/sessions/${sessionId}/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          files: dirtyFiles.map((f) => ({
            path: f.path,
            content: f.content,
            originalSha: f.originalSha,
          })),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const serverMsg = body?.error?.message ?? `status ${res.status}`
        throw new Error(`Save failed: ${serverMsg}`)
      }

      setSaveStatus('saved')
      setLastSavedAt(new Date())
    } catch (err) {
      console.error('[useDraftSave] save error:', err)
      setSaveStatus('error')
      addToast('error', 'Save failed. Please try again.')
    }
  }, [sessionId, getDirtyFiles, addToast])

  return { saveStatus, lastSavedAt, hasDirtyFiles, save }
}
