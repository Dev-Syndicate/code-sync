'use client'

import type { ConnectionStatus } from '@/hooks/useConnectionStatus'

interface SessionHeaderProps {
  connectionStatus: ConnectionStatus
  repoName?: string
  branch?: string
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; label: string }
> = {
  connected: { color: 'bg-emerald-500', label: 'Live' },
  connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Connecting' },
  disconnected: { color: 'bg-red-500', label: 'Offline' },
}

export function SessionHeader({
  connectionStatus,
  repoName = 'Repository',
  branch = 'main',
}: SessionHeaderProps) {
  const statusCfg = STATUS_CONFIG[connectionStatus]

  return (
    <header className="flex items-center gap-3 px-4 h-12 bg-card border-b border-border shrink-0">
      <h1 className="text-sm font-semibold text-foreground truncate max-w-[60ch]">
        {repoName}
      </h1>

      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        {branch}
      </span>

      {/* Connection dot */}
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={`w-2 h-2 rounded-full ${statusCfg.color}`} />
        {statusCfg.label}
      </span>
    </header>
  )
}
