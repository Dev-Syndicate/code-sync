'use client'

export type SidebarTabId = 'team' | 'agent'

interface Tab {
  id: SidebarTabId
  label: string
}

const TABS: Tab[] = [
  { id: 'team', label: 'Team Chat' },
  { id: 'agent', label: 'AI Agent' },
]

interface Props {
  active: SidebarTabId
  onChange: (id: SidebarTabId) => void
}

export function SidebarTabs({ active, onChange }: Props) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: isActive
                ? '2px solid var(--accent, #6366f1)'
                : '2px solid transparent',
              color: isActive
                ? 'var(--text-primary)'
                : 'var(--text-muted)',
              padding: 'var(--space-3) var(--space-2)',
              fontSize: 'var(--text-xs)',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
