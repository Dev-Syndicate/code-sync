'use client'

import { use, useState, useCallback, useMemo } from 'react'
import type { editor } from 'monaco-editor'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { FileTree } from '@/components/editor/FileTree'
import { EditorTabs } from '@/components/editor/EditorTabs'
import { CollabCursor } from '@/components/editor/CollabCursor'
import { SessionHeader } from '@/components/session/SessionHeader'
import { ParticipantList } from '@/components/session/ParticipantList'
import { useEditor } from '@/hooks/useEditor'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { useFileEditorTracking } from '@/hooks/useFileEditorTracking'
import { useAuth } from '@/hooks/useAuth'
import { CURSOR_COLORS } from '@/types/session'
import type { RemoteCursor } from '@/types/editor'

export default function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)
  const { user } = useAuth()

  // ── Mock user for development (until Dev 1 delivers useAuth) ──
  const currentUser = useMemo(
    () => ({
      uid: user?.uid ?? 'dev-user-1',
      username: user?.username ?? 'Developer',
      avatar: user?.avatar ?? '',
      email: user?.email ?? 'dev@codesync.app',
      color: CURSOR_COLORS[0],
    }),
    [user]
  )

  // ── Editor state ──
  const {
    activeFile,
    activeTab,
    settings,
    updateFileContent,
  } = useEditor()

  // ── Monaco editor instance ──
  const [editorInstance, setEditorInstance] =
    useState<editor.IStandaloneCodeEditor | null>(null)

  // ── Collaboration (Yjs + WebRTC) ──
  const { provider, isReady, remoteUsers } = useCollaboration({
    sessionId,
    userId: currentUser.uid,
    username: currentUser.username,
    avatar: currentUser.avatar,
    color: currentUser.color,
  })

  // ── Connection status ──
  const connectionStatus = useConnectionStatus(provider)

  // ── File editor tracking (Firestore) ──
  useFileEditorTracking({
    sessionId,
    userId: currentUser.uid,
    username: currentUser.username,
    email: currentUser.email,
    avatar: currentUser.avatar,
    currentFile: activeFile,
  })

  // ── Remote cursors (convert awareness states → RemoteCursor[]) ──
  const remoteCursors: RemoteCursor[] = useMemo(
    () =>
      remoteUsers
        .filter((u) => u.currentFile === activeFile && u.cursor)
        .map((u) => ({
          userId: u.userId,
          username: u.username,
          color: u.color,
          file: u.currentFile ?? '',
          position: u.cursor!,
        })),
    [remoteUsers, activeFile]
  )

  // ── Editor change handler ──
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeFile && value !== undefined) {
        updateFileContent(activeFile, value)
      }
    },
    [activeFile, updateFileContent]
  )

  // ── Editor mount handler ──
  const handleEditorMount = useCallback(
    (instance: editor.IStandaloneCodeEditor) => {
      setEditorInstance(instance)
    },
    []
  )

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-white overflow-hidden">
      {/* ── Top bar ── */}
      <SessionHeader
        sessionId={sessionId}
        connectionStatus={connectionStatus}
        participantCount={remoteUsers.length + 1}
      />

      {/* ── Main content area ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left sidebar: File tree ── */}
        <div className="w-60 shrink-0 border-r border-white/10 bg-[#252526] flex flex-col">
          <FileTree className="flex-1" />

          {/* ── Participant list ── */}
          <div className="border-t border-white/10">
            <ParticipantList
              remoteUsers={remoteUsers}
              currentUser={currentUser}
            />
          </div>
        </div>

        {/* ── Center: Editor panel ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <EditorTabs />

          {/* Editor area */}
          <div className="flex-1 relative">
            {activeTab ? (
              <>
                <CodeEditor
                  value={activeTab.content}
                  language={activeTab.language}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  settings={settings}
                />
                <CollabCursor
                  editor={editorInstance}
                  cursors={remoteCursors}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-white/30">
                  <div className="text-5xl mb-4">📝</div>
                  <p className="text-lg font-medium">No file open</p>
                  <p className="text-sm mt-1">
                    Select a file from the explorer to start editing
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Status bar ── */}
          <div className="flex items-center justify-between px-3 h-6 text-[11px] bg-[#007acc] text-white shrink-0">
            <div className="flex items-center gap-3">
              {/* Connection status */}
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-green-400'
                      : connectionStatus === 'connecting'
                        ? 'bg-yellow-400 animate-pulse'
                        : 'bg-red-400'
                  }`}
                />
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected'}
              </span>

              {/* Collab status */}
              {isReady && (
                <span className="opacity-70">
                  {remoteUsers.length > 0
                    ? `${remoteUsers.length + 1} collaborators`
                    : 'Solo editing'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {activeTab && (
                <>
                  <span className="opacity-70">{activeTab.language}</span>
                  <span className="opacity-70">
                    Tab Size: {settings.tabSize}
                  </span>
                  <span className="opacity-70">UTF-8</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar: Chat placeholder (Dev 4's territory) ── */}
        <div className="w-72 shrink-0 border-l border-white/10 bg-[#252526] flex items-center justify-center">
          <div className="text-center text-white/20 p-4">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-xs">Chat panel</p>
            <p className="text-[10px] mt-1 opacity-60">
              (Dev 4 will implement this)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
