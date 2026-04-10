// Canonical file-extension → Monaco language ID mapping.
//
// Used on the server (session creation, refresh-tree) so every file entry
// written into the session doc has a consistent `language` field. The
// client's editorStore has its own local guessLanguage() helper used when
// creating files via the Explorer; that one has a slightly wider map
// (typescriptreact vs typescript, etc.) but for GitHub-sourced files we
// stick with the narrower server-side mapping to preserve the existing
// behavior of POST /api/sessions.

const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'shell',
  sql: 'sql',
  kt: 'kotlin',
  swift: 'swift',
  dart: 'dart',
}

export function inferLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_MAP[ext] ?? 'plaintext'
}
