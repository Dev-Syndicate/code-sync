import { adminStorage } from '@/lib/firebase/admin'

// Firebase Storage custom metadata values must be strings. We use this
// sentinel to round-trip `null` originalSha (brand-new files the user
// created in the Explorer that have no GitHub blob yet).
const NEW_FILE_SHA_SENTINEL = '__new_file__'

// Sidecar files in the drafts prefix that are NOT actual drafts. Filter
// these out of loadDraft() so the Save Revert flow doesn't try to restore
// them as if they were user files.
const DRAFT_SIDECAR_FILES = new Set(['__pending_deletes__.json'])

export interface DraftFile {
  path: string
  content: string
  /**
   * The GitHub blob SHA the draft was based on, or `null` for files created
   * locally in the Explorer that have no GitHub counterpart yet. New files
   * are persisted with `originalSha: null` and picked up by the commit flow
   * as brand-new blobs.
   */
  originalSha: string | null
}

export interface SavedDraftFile extends DraftFile {
  uploadedBy: string
  uploadedAt: string
}

export async function saveDraft(
  sessionId: string,
  uploadedBy: string,
  files: DraftFile[]
): Promise<void> {
  const bucket = adminStorage.bucket(
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET
  )

  await Promise.all(
    files.map((file) => {
      const uploadedAt = new Date().toISOString()
      return bucket.file(`drafts/${sessionId}/${file.path}`).save(file.content, {
        metadata: {
          metadata: {
            originalSha: file.originalSha ?? NEW_FILE_SHA_SENTINEL,
            uploadedBy,
            uploadedAt,
          },
        },
      })
    })
  )
}

export async function loadDraft(sessionId: string): Promise<SavedDraftFile[]> {
  const bucket = adminStorage.bucket(
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET
  )
  const [allFiles] = await bucket.getFiles({ prefix: `drafts/${sessionId}/` })

  // Skip sidecar files like __pending_deletes__.json that share the prefix
  // but aren't user draft content.
  const files = allFiles.filter((f) => {
    const base = f.name.slice(`drafts/${sessionId}/`.length)
    return !DRAFT_SIDECAR_FILES.has(base)
  })

  if (files.length === 0) return []

  return Promise.all(
    files.map(async (file) => {
      const [contents] = await file.download()
      const content = contents.toString('utf-8')
      const custom = (file.metadata.metadata ?? {}) as Record<string, string>
      const path = file.name.slice(`drafts/${sessionId}/`.length)

      const rawSha = custom.originalSha
      return {
        path,
        content,
        originalSha:
          rawSha === NEW_FILE_SHA_SENTINEL || !rawSha ? null : rawSha,
        uploadedBy:  custom.uploadedBy,
        uploadedAt:  custom.uploadedAt,
      }
    })
  )
}

export async function deleteSessionDrafts(sessionId: string): Promise<void> {
  const bucket = adminStorage.bucket(
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET
  )
  await bucket.deleteFiles({ prefix: `drafts/${sessionId}/` })
}
