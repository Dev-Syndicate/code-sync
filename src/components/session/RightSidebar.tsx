'use client'

// RightSidebar
// ────────────
// Wraps the team chat + AI agent behind a tab switcher so they share the
// same right-hand panel in the session layout. Owns only the local tab
// state; each child manages its own data.

import { useState } from 'react'
import type * as Y from 'yjs'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { SidebarTabs, type SidebarTabId } from './SidebarTabs'

interface Props {
  sessionId: string
  ydoc: Y.Doc | null
}

export function RightSidebar({ sessionId, ydoc }: Props) {
  const [active, setActive] = useState<SidebarTabId>('team')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-default)',
      }}
    >
      <SidebarTabs active={active} onChange={setActive} />
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
        {active === 'team' ? (
          <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
            <ChatPanel sessionId={sessionId} />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
            <AgentPanel sessionId={sessionId} ydoc={ydoc} />
          </div>
        )}
      </div>
    </div>
  )
}
