'use client'

import { use, useState, useCallback, useEffect, useMemo } from 'react'
import type { editor } from 'monaco-editor'
import { FileText, MessageSquare, PanelRightClose, Sparkles } from 'lucide-react'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { FileTree } from '@/components/editor/FileTree'
import { EditorTabs } from '@/components/editor/EditorTabs'
import { SessionHeader } from '@/components/session/SessionHeader'
import { ActivityBar } from '@/components/session/ActivityBar'
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
import { usePendingDeletesSync } from '@/hooks/usePendingDeletesSync'
import { useSharedFileTree } from '@/hooks/useSharedFileTree'
import { useEditorStore } from '@/store/editorStore'
import { buildFileTree, type FlatFileEntry } from '@/lib/editor/buildFileTree'
import { RightSidebar } from '@/components/session/RightSidebar'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useToastStore } from '@/store/toastStore'
import { useRouter } from 'next/navigation'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { CURSOR_COLORS } from '@/types/session'

function formatRelativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

// buildFileTree moved to @/lib/editor/buildFileTree so the Explorer's
// refresh flow can reuse the same flat → nested conversion logic.

export default function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)
  const { user } = useAuth()
  const setFiles = useEditorStore((s) => s.setFiles)
  const router = useRouter()
  const addToast = useToastStore((s) => s.addToast)
  const [ownerUid, setOwnerUid] = useState<string | null>(null)

  // ── Session metadata (repo/owner/branch) — needed so FileTree can
  //    load file contents from the correct GitHub repo on click.
  const [repoInfo, setRepoInfo] = useState<{
    owner: string
    repo: string
    branch: string
  } | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [treeLoaded, setTreeLoaded] = useState(false)

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
        setTreeLoaded(true)
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
      setTreeLoaded(false)
    }
  }, [sessionId, setFiles])

  // Live subscription to the session doc for (a) computing isHost once the
  // owner field lands, and (b) reacting when the host ends the session —
  // we flip everyone (host included) back to /dashboard so there's a
  // single exit path.
  useEffect(() => {
    if (!sessionId) return
    const ref = doc(db, 'sessions', sessionId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return
        const data = snap.data() as { owner?: string; active?: boolean }
        if (data.owner) setOwnerUid(data.owner)
        if (data.active === false) {
          addToast('info', 'This session has been ended by the host.')
          router.replace('/dashboard')
        }
      },
      (err) => {
        console.error('[SessionPage] session listener failed:', err)
      },
    )
    return () => unsub()
  }, [sessionId, router, addToast])

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

  // ── Panel visibility state ──
  const [filesOpen, setFilesOpen] = useState(true)
  const [chatCollapsed, setChatCollapsed] = useState(false)

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

  // Persist Explorer-initiated deletions across reload. Seeds pendingDeletes
  // from the server and prunes the tree on mount, then debounces PUTs as
  // the user continues to delete/rename files.
  usePendingDeletesSync({ sessionId, treeReady: treeLoaded })

  // Propagate Explorer-created files/folders across every peer via a
  // shared Y.Map in the ydoc. Gated on treeLoaded so we don't race the
  // initial GitHub snapshot fetch.
  useSharedFileTree({ ydoc, treeReady: treeLoaded })

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

  // ── Host: end-session handler (wired to the SessionHeader menu) ──
  //
  // Confirmation is now owned by the SessionHeader's themed ConfirmDialog,
  // so this handler is the raw API call — POST the end route and let the
  // Firestore `active:false` listener redirect everyone (host included).
  const isHost = !!ownerUid && ownerUid === user?.uid
  const handleEndSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        addToast('error', body?.error?.message ?? 'Failed to end session.')
      }
    } catch (err) {
      console.error('[SessionPage] end session failed:', err)
      addToast('error', 'Failed to end session.')
    }
  }, [sessionId, addToast])

  // ── Participants for the header avatar row ──
  //
  // remoteUsers are the y-awareness states for everyone *else* — we
  // prepend the local user so the row shows the full roster.
  const headerParticipants = useMemo(
    () => [
      {
        uid: currentUser.uid,
        username: currentUser.username,
        avatar: currentUser.avatar || undefined,
        color: currentUser.color,
      },
      ...remoteUsers.map((u) => ({
        uid: u.userId,
        username: u.username,
        avatar: u.avatar || undefined,
        color: u.color,
      })),
    ],
    [currentUser, remoteUsers],
  )

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* ── Top bar ── */}
      <SessionHeader
        connectionStatus={connectionStatus}
        repoName={
          repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : undefined
        }
        branch={repoInfo?.branch}
        participants={headerParticipants}
        currentUserId={currentUser.uid}
        isHost={isHost}
        onEndSession={handleEndSession}
      />

      {/* ── Body: ActivityBar (fixed) + resizable panels ── */}
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          sessionId={sessionId}
          participantCount={remoteUsers.length + 1}
          filesOpen={filesOpen}
          onToggleFiles={() => setFilesOpen((v) => !v)}
          onSave={save}
          saveStatus={saveStatus}
          hasDirtyFiles={hasDirtyFiles}
          onRevertSave={revertToLastSave}
          revertStatus={revertStatus}
          onCommitReverted={handleCommitReverted}
        />

      <ResizablePanelGroup
        orientation="horizontal"
        className="flex-1 overflow-hidden"
      >
        {/* ── Left: File tree (toggleable from ActivityBar) ── */}
        {filesOpen && (
          <>
            <ResizablePanel
              defaultSize={18}
              minSize={10}
              className="overflow-hidden border-r border-border bg-card"
            >
              <div className="flex h-full min-w-0 flex-col overflow-hidden">
                {sessionError ? (
                  <div className="p-4 text-xs text-destructive">{sessionError}</div>
                ) : (
                  <FileTree
                    className="flex-1 min-w-0"
                    repoOwner={repoInfo?.owner ?? null}
                    repoName={repoInfo?.repo ?? null}
                    sessionId={sessionId}
                    ydoc={ydoc}
                  />
                )}

                {/* ── Participant list ── */}
                <div className="min-w-0 border-t border-border">
                  <ParticipantList
                    remoteUsers={remoteUsers}
                    currentUser={currentUser}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />
          </>
        )}

        {/* ── Center: Editor ── */}
        <ResizablePanel defaultSize={58} minSize={20} className="overflow-hidden">
          <div className="flex h-full flex-col min-w-0 overflow-hidden">
            {/* Tab bar */}
            <EditorTabs />

            {/* Editor area */}
            <div className="flex-1 relative">
              {activeTab ? (
                <CodeEditor
                  path={activeTab.path}
                  language={activeTab.language}
                  value={activeTab.content}
                  onMount={handleEditorMount}
                  settings={settings}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="max-w-sm text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/15">
                      <FileText
                        className="h-6 w-6 text-primary"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      No file open
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pick a file from the Explorer to start editing. Your
                      changes sync live with everyone in the session.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1">
                        <kbd className="font-mono font-semibold text-foreground">
                          Ctrl
                        </kbd>
                        <span>+</span>
                        <kbd className="font-mono font-semibold text-foreground">
                          S
                        </kbd>
                        <span className="ml-1">save draft</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1">
                        <Sparkles
                          className="h-3 w-3 text-primary"
                          strokeWidth={2.25}
                          aria-hidden
                        />
                        AI Agent panel on the right
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Status bar ── */}
            {/*
              Connection state is deliberately NOT rendered here anymore —
              the SessionHeader already shows "Live / Connecting / Offline"
              at the top of the page, and duplicating it at the bottom was
              just visual noise. The bottom bar focuses on session vitals
              (collab count, save state) and the active-file metadata.
            */}
            <div className="flex items-center justify-between px-3 h-6 text-[11px] bg-card border-t border-border text-muted-foreground shrink-0">
              <div className="flex items-center gap-3">
                {/* Collab count — always visible once the provider is ready */}
                {isReady && (
                  <span className="flex items-center gap-1">
                    <span className="font-semibold tabular-nums text-foreground">
                      {remoteUsers.length + 1}
                    </span>
                    {remoteUsers.length > 0 ? 'in session' : 'solo'}
                  </span>
                )}

                {/* Save status */}
                {saveStatus === 'saving' && <span>Saving...</span>}
                {saveStatus === 'error' && <span className="text-destructive">Save failed</span>}
                {saveStatus === 'saved' && lastSavedAt && <span>Saved just now</span>}
                {saveStatus === 'idle' && lastSavedAt && (
                  <span>Saved {formatRelativeTime(lastSavedAt)} ago</span>
                )}

                {/* Hint when no file is open — keeps the bar populated */}
                {!activeTab && (
                  <span className="text-muted-foreground/70">
                    Select a file from the Explorer to begin
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {activeTab && (
                  <>
                    <span>{activeTab.language}</span>
                    <span>Tab Size: {settings.tabSize}</span>
                    <span>UTF-8</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        {/* ── Right: Chat (resizable when open) ── */}
        {!chatCollapsed && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={24}
              minSize={12}
              className="overflow-hidden"
            >
              <div className="relative h-full min-w-0 overflow-hidden">
                {/* Collapse button — absolute top-right over the chat header */}
                <button
                  type="button"
                  onClick={() => setChatCollapsed(true)}
                  aria-label="Collapse chat"
                  title="Collapse chat"
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <PanelRightClose className="h-4 w-4" strokeWidth={2} />
                </button>
                <RightSidebar sessionId={sessionId} ydoc={ydoc} />
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Collapsed chat rail — shown when chatCollapsed is true */}
      {chatCollapsed && (
        <button
          type="button"
          onClick={() => setChatCollapsed(false)}
          aria-label="Expand chat"
          title="Expand chat"
          className="group flex w-10 shrink-0 flex-col items-center justify-start gap-3 border-l border-border bg-card py-4 transition-colors hover:bg-accent"
        >
          <MessageSquare
            className="h-[18px] w-[18px] text-muted-foreground group-hover:text-foreground"
            strokeWidth={1.75}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground"
            style={{ writingMode: 'vertical-rl' }}
          >
            Chat
          </span>
        </button>
      )}
      </div>
    </div>
  )
}
