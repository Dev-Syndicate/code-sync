export interface EditorTab {
  path: string
  language: string
  content: string
  isActive: boolean
  isDirty: boolean
  originalSha: string
}

export interface CursorPosition {
  line: number
  column: number
}

export interface RemoteCursor {
  userId: string
  username: string
  color: string
  file: string
  position: CursorPosition
}

export interface EditorSettings {
  fontSize: number
  tabSize: number
  wordWrap: 'on' | 'off'
  minimap: boolean
  theme: 'vs-dark' | 'vs-light'
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  minimap: false,
  theme: 'vs-dark',
}
