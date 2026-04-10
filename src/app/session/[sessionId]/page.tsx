'use client'

import { use, useState, useCallback, useEffect, useMemo } from 'react'
import type { editor } from 'monaco-editor'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { FileTree } from '@/components/editor/FileTree'
import { EditorTabs } from '@/components/editor/EditorTabs'
import { SessionHeader } from '@/components/session/SessionHeader'
import { ParticipantList } from '@/components/session/ParticipantList'
import { useEditor } from '@/hooks/useEditor'
import { useCollaboration } from '@/hooks/useCollaboration'
import { updateCurrentFile } from '@/lib/yjs/awareness'
import { useMonacoYjsBinding } from '@/hooks/useMonacoYjsBinding'
import { useDraftRevert } from '@/hooks/useDraftRevert'
import type { RevertedFile } from '@/components/session/CommitHistoryModal'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { useFileEditorTracking } from '@/hooks/useFileEditorTracking'
import { useAuth } from '@/hooks/useAuth'
import { useDraftSave } from '@/hooks/useDraftSave'
import { useEditorStore, type FileNode } from '@/store/editorStore'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CURSOR_COLORS } from '@/types/session'

function formatRelativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

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
  } = useEditor()

  // ── Monaco editor instance ──
  const [editorInstance, setEditorInstance] =
    useState<editor.IStandaloneCodeEditor | null>(null)

  // ── Collaboration (Yjs + WebRTC) ──
  const { ydoc, provider, isReady, remoteUsers } = useCollaboration({
    sessionId,
    userId: currentUser.uid,
    username: currentUser.username,
    avatar: currentUser.avatar,
    color: currentUser.color,
  })

  // ── Bind Monaco to the per-file Y.Text so edits + selections replicate ──
  // `activeTab.content` is what `openFile` just put in the store (GitHub or
  // restored draft). It's used as the seed only if the file's Y.Text is
  // empty — otherwise we pull the live collaborative state from peers.
  const handleYjsContentChange = useCallback(
    (file: string, content: string) => {
      // Only touch the store when the content actually changed. Prevents a
      // spurious "dirty" mark when the binding mirrors its own seed back
      // through the observer on first mount.
      const tab = useEditorStore.getState().tabs.find((t) => t.path === file)
      if (!tab || tab.content === content) return
      useEditorStore.getState().updateFileContent(file, content)
    },
    []
  )
  useMonacoYjsBinding({
    editor: editorInstance,
    ydoc,
    provider,
    isReady,
    activeFile,
    initialContent: activeTab?.content,
    onContentChange: handleYjsContentChange,
  })

  // Publish the active file into awareness so peers know which file the
  // local user is viewing (used by ParticipantList and — if we ever render
  // per-file cursor lists — by the cursor UI). y-monaco handles the caret
  // itself via `state.selection`; `state.user.currentFile` is our own field.
  useEffect(() => {
    if (!provider || !activeFile) return
    updateCurrentFile(provider, activeFile)
  }, [provider, activeFile])

  // ── Connection status ──
  const connectionStatus = useConnectionStatus(provider)

  // ── Draft save ──
  const { save, saveStatus, hasDirtyFiles, lastSavedAt } = useDraftSave({ sessionId })

  // ── Save Revert — roll every open file back to its last saved draft ──
  const { revertToLastSave, revertStatus } = useDraftRevert({ sessionId, ydoc })

  // ── Commit Revert — hard-reset Y.Text for files the revert touched ──
  //
  // The /api/commits/revert route returns the post-revert content for every
  // file the inverse commit changed. We rewrite each file's Y.Text inside a
  // single transaction so every peer's editor snaps to the reverted state
  // in lockstep. Files that aren't currently open don't need handling — the
  // next `openFile` will pull the fresh (post-revert) content from GitHub.
  const handleCommitReverted = useCallback(
    (affectedFiles: RevertedFile[]) => {
      if (!ydoc) return
      const { tabs, closeFile, markDirty } = useEditorStore.getState()
      const openPaths = new Set(tabs.map((t) => t.path))

      ydoc.transact(() => {
        for (const file of affectedFiles) {
          if (!openPaths.has(file.path)) continue
          const ytext = ydoc.getText(`file:${file.path}`)
          if (ytext.length > 0) ytext.delete(0, ytext.length)
          if (file.operation !== 'delete' && file.content) {
            ytext.insert(0, file.content)
          }
        }
      })

      // For files the revert DELETED, close the tab — there's nothing to
      // look at anymore. For modify/create, clear dirty since the buffer
      // now matches the new baseline on GitHub.
      queueMicrotask(() => {
        for (const file of affectedFiles) {
          if (!openPaths.has(file.path)) continue
          if (file.operation === 'delete') {
            closeFile(file.path)
          } else {
            markDirty(file.path, false)
          }
        }
      })
    },
    [ydoc],
  )

  // ── File editor tracking (Firestore) ──
  useFileEditorTracking({
    sessionId,
    userId: currentUser.uid,
    username: currentUser.username,
    email: currentUser.email,
    avatar: currentUser.avatar,
    currentFile: activeFile,
  })

  // Remote cursors are rendered automatically by y-monaco via Monaco
  // decorations driven off `provider.awareness.selection` — see the
  // .yRemoteSelection* classes in globals.css. No React wrapper needed.

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
        onSave={save}
        saveStatus={saveStatus}
        hasDirtyFiles={hasDirtyFiles}
        onRevertSave={revertToLastSave}
        revertStatus={revertStatus}
        onCommitReverted={handleCommitReverted}
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
              sessionId={sessionId}
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
              <CodeEditor
                // `path` forces a distinct Monaco model per file, so switching
                // tabs swaps models instead of replacing content in one shared
                // model. Essential for the Y.Text-per-file binding.
                path={activeTab.path}
                language={activeTab.language}
                onMount={handleEditorMount}
                settings={settings}
              />
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

              {/* Save status */}
              {saveStatus === 'saving' && <span className="opacity-70">Saving...</span>}
              {saveStatus === 'error' && <span className="text-red-300">Save failed</span>}
              {saveStatus === 'saved' && lastSavedAt && <span className="opacity-70">Saved just now</span>}
              {saveStatus === 'idle' && lastSavedAt && (
                <span className="opacity-70">Saved {formatRelativeTime(lastSavedAt)} ago</span>
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
