import { adminStorage } from '@/lib/firebase/admin'

export interface DraftFile {
  path: string
  content: string
  originalSha: string
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
            originalSha: file.originalSha,
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
  const [files] = await bucket.getFiles({ prefix: `drafts/${sessionId}/` })

  if (files.length === 0) return []

  return Promise.all(
    files.map(async (file) => {
      const [contents] = await file.download()
      const content = contents.toString('utf-8')
      const custom = (file.metadata.metadata ?? {}) as Record<string, string>
      const path = file.name.slice(`drafts/${sessionId}/`.length)

      return {
        path,
        content,
        originalSha: custom.originalSha,
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
