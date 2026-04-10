// Auto-builds a commit message with GitHub co-author trailers
// Reads fileEditors subcollection to credit everyone who touched the files

import { adminDb } from '@/lib/firebase/admin'
import type { EditorEntry } from '@/types/session'

export async function buildCommitMessage(
  sessionId:   string,
  committerId: string,
  userMessage: string
): Promise<string> {
  // 1. Fetch all fileEditors documents for this session
  const editorsSnap = await adminDb
    .collection('sessions')
    .doc(sessionId)
    .collection('fileEditors')
    .get()

  // 2. Collect unique editors across all files (exclude the committer)
  const editorMap = new Map<string, EditorEntry>()

  editorsSnap.forEach((doc) => {
    const { editors } = doc.data() as { editors: EditorEntry[] }
    editors.forEach((editor) => {
      if (editor.userId !== committerId) {
        editorMap.set(editor.userId, editor)
      }
    })
  })

  // 3. Build Co-authored-by trailers
  // GitHub requires: Co-authored-by: Name <email>
  const coAuthorLines = Array.from(editorMap.values())
    .map((editor) => {
      // Use GitHub noreply email if no real email available
      const email = editor.email?.trim()
        || `${editor.username}@users.noreply.github.com`
      return `Co-authored-by: ${editor.githubName} <${email}>`
    })
    .join('\n')

  // 4. Assemble final message
  // GitHub reads co-authors from the commit body (after a blank line)
  return coAuthorLines
    ? `${userMessage}\n\n${coAuthorLines}`
    : userMessage
}
