// Dev 1 — Firebase Storage helpers
// Draft auto-save, draft retrieval, draft cleanup

import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase/config'

/**
 * Saves a draft of a file to Firebase Storage.
 * Path: /drafts/{sessionId}/{filename}
 */
export async function saveDraft(
  sessionId: string,
  filename: string,
  content: string
): Promise<string> {
  const draftRef = ref(storage, `drafts/${sessionId}/${filename}`)
  await uploadString(draftRef, content)
  return getDownloadURL(draftRef)
}

/**
 * Retrieves a draft file URL from Firebase Storage.
 * Returns null if the draft doesn't exist.
 */
export async function getDraftUrl(
  sessionId: string,
  filename: string
): Promise<string | null> {
  try {
    const draftRef = ref(storage, `drafts/${sessionId}/${filename}`)
    return await getDownloadURL(draftRef)
  } catch {
    return null
  }
}

/**
 * Deletes a specific draft file from Firebase Storage.
 */
export async function deleteDraft(
  sessionId: string,
  filename: string
): Promise<void> {
  try {
    const draftRef = ref(storage, `drafts/${sessionId}/${filename}`)
    await deleteObject(draftRef)
  } catch {
    // Draft may not exist — ignore
  }
}
