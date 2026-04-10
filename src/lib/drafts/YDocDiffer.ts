import * as Y from 'yjs'

export interface FileOriginal {
  path: string
  content: string
  sha: string
}

export interface FileChange {
  path: string
  content: string
  originalSha: string
}

export function diffAgainstOriginal(
  ydoc: Y.Doc,
  originals: FileOriginal[]
): FileChange[] {
  const originalsMap = new Map(originals.map((o) => [o.path, o]))
  const changes: FileChange[] = []

  ydoc.share.forEach((type, key) => {
    if (!key.startsWith('file:')) return

    const filePath = key.slice('file:'.length)
    const original = originalsMap.get(filePath)
    if (!original) return

    const current = (type as Y.Text).toString()
    if (current !== original.content) {
      changes.push({
        path:        filePath,
        content:     current,
        originalSha: original.sha,
      })
    }
  })

  return changes
}
