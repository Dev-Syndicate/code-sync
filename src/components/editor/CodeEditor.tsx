'use client'

import dynamic from 'next/dynamic'
import { Loader } from '@/components/ui/Loader'
import type { EditorSettings } from '@/types/editor'
import type { editor } from 'monaco-editor'

// ⚡ Lazy load Monaco — only downloaded when the editor page is visited
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <Loader text="Loading editor..." size="lg" />
      </div>
    ),
  }
)

interface CodeEditorProps {
  /** File path — used as the Monaco model URI so each file gets its own model. */
  path?: string
  /** Fallback initial content. Ignored once y-monaco binds to the model. */
  value?: string
  language: string
  onChange?: (value: string | undefined) => void
  onMount?: (editor: editor.IStandaloneCodeEditor) => void
  readOnly?: boolean
  settings?: EditorSettings
}

export function CodeEditor({
  path,
  value,
  language,
  onChange,
  onMount,
  readOnly = false,
  settings,
}: CodeEditorProps) {
  return (
    <MonacoEditor
      height="100%"
      path={path}
      language={language}
      defaultValue={value ?? ''}
      onChange={onChange}
      theme={settings?.theme ?? 'vs-dark'}
      onMount={(editorInstance) => {
        // Focus the editor when it mounts
        editorInstance.focus()
        onMount?.(editorInstance)
      }}
      options={{
        readOnly,
        fontSize: settings?.fontSize ?? 14,
        fontFamily: "'Geist Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        minimap: { enabled: settings?.minimap ?? false },
        scrollBeyondLastLine: false,
        wordWrap: settings?.wordWrap ?? 'on',
        automaticLayout: true,
        tabSize: settings?.tabSize ?? 2,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: 'all',
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          indentation: true,
        },
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  )
}
