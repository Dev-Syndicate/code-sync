'use client'

import { use, useState, useCallback, useEffect, useMemo } from 'react'
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
import { useEditorStore, type FileNode } from '@/store/editorStore'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CURSOR_COLORS } from '@/types/session'
import type { RemoteCursor } from '@/types/editor'

// ── Flat path list → nested FileNode tree (VS Code Explorer style) ──
// Input: [{ path: 'src/app/page.tsx', language: 'typescript' }, ...]
// Output: [{ name: 'src', type: 'directory', children: [...] }, ...]
interface FlatFileEntry {
  path: string
  language: string
}
function buildFileTree(files: FlatFileEntry[]): FileNode[] {
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

  // Sort: directories first, then files, both alphabetical — matches
  // VS Code Explorer ordering.
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) {
      if (n.type === 'directory' && n.children) sortNodes(n.children)
    }
    return nodes
  }

  return sortNodes(root)
}

export default function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)
  const { user } = useAuth()
  const setFiles = useEditorStore((s) => s.setFiles)

  // ── Session metadata (repo/owner/branch) — needed so FileTree can
  //    load file contents from the correct GitHub repo on click.
  const [repoInfo, setRepoInfo] = useState<{
    owner: string
    repo: string
    branch: string
  } | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Fetch the session doc on mount. It contains the flat `files` array
  // (populated by POST /api/sessions from GitHub's git/trees endpoint),
  // which we fold into a nested FileNode tree for the left sidebar.
  //
  // We POST to /api/sessions/[id]/join *first* so that the current user is
  // added to the session's participants map. Otherwise GET /api/sessions/[id]
  // would 403 them out with "You are not a member of this session" whenever
  // someone opens the session via a share link for the first time. The join
  // endpoint is idempotent — a no-op for owners and existing participants.
  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    void (async () => {
      try {
        // Step 1: join (idempotent). Failures here are fatal — without a
        // participant entry the GET below will 403.
        const joinRes = await fetch(`/api/sessions/${sessionId}/join`, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: ac.signal,
        })
        if (cancelled) return
        if (!joinRes.ok) {
          const body = await joinRes.json().catch(() => null)
          setSessionError(body?.error?.message ?? `Failed to join session (${joinRes.status})`)
          return
        }

        // Step 2: fetch the session doc + file list.
        const res = await fetch(`/api/sessions/${sessionId}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: ac.signal,
        })
        if (cancelled) return

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          setSessionError(body?.error?.message ?? `Failed to load session (${res.status})`)
          return
        }

        const json = await res.json()
        if (!json?.success || !json.data) {
          setSessionError('Malformed session response.')
          return
        }

        const session = json.data as {
          repo: string
          repoOwner: string
          branch: string
          files: FlatFileEntry[]
        }

        if (cancelled) return
        setRepoInfo({
          owner: session.repoOwner,
          repo: session.repo,
          branch: session.branch,
        })
        setFiles(buildFileTree(session.files ?? []))
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[SessionPage] load session failed:', err)
        setSessionError('Failed to load session.')
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
      // Clear the file tree on unmount so switching sessions doesn't show
      // stale files from a previous session while the new one loads.
      setFiles([])
    }
  }, [sessionId, setFiles])

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
          {sessionError ? (
            <div className="p-4 text-xs text-red-400">{sessionError}</div>
          ) : (
            <FileTree
              className="flex-1"
              repoOwner={repoInfo?.owner ?? null}
              repoName={repoInfo?.repo ?? null}
            />
          )}

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

        {/* ── Right sidebar: Chat (Dev 4) ── */}
        <div className="w-72 shrink-0">
          <ChatPanel sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}
