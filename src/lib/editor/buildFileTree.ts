// Flat path list → nested FileNode tree (VS Code Explorer style).
//
// Shared between the session page (initial tree build) and FileTree's
// refresh flow (rebuilding after a GitHub refresh). Both callers format
// files as { path, language } pairs.

import type { FileNode } from '@/store/editorStore'

export interface FlatFileEntry {
  path: string
  language: string
}

export function buildFileTree(files: FlatFileEntry[]): FileNode[] {
  const root: FileNode[] = []

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean)
    let currentLevel = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLeaf = i === parts.length - 1

      let node = currentLevel.find((n) => n.name === part)
      if (!node) {
        node = isLeaf
          ? {
              name: part,
              path: file.path,
              type: 'file',
              language: file.language,
            }
          : {
              name: part,
              path: currentPath,
              type: 'directory',
              children: [],
            }
        currentLevel.push(node)
      }

      if (!isLeaf && node.type === 'directory' && node.children) {
        currentLevel = node.children
      }
    }
  }

  return sortNodesRecursive(root)
}

// Directories first, then files — VS Code Explorer ordering.
function sortNodesRecursive(nodes: FileNode[]): FileNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const n of nodes) {
    if (n.type === 'directory' && n.children) sortNodesRecursive(n.children)
  }
  return nodes
}
