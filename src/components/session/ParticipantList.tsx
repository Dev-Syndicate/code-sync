'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Users } from 'lucide-react'
import type { AwarenessUserState } from '@/lib/yjs/awareness'
import { cn } from '@/lib/utils'

interface ParticipantListProps {
  remoteUsers: AwarenessUserState[]
  currentUser: {
    uid: string
    username: string
    avatar: string
    color: string
  }
}

export function ParticipantList({
  remoteUsers,
  currentUser,
}: ParticipantListProps) {
  const [isOpen, setIsOpen] = useState(false)

  const allUsers = [
    {
      userId: currentUser.uid,
      username: currentUser.username,
      avatar: currentUser.avatar,
      color: currentUser.color,
      currentFile: null,
      isLocal: true,
    },
    ...remoteUsers.map((u) => ({ ...u, isLocal: false })),
  ]

  return (
    // flex-col-reverse so the toggle bar is rendered first in DOM
    // but stays pinned at the BOTTOM, with the drawer growing upward.
    <div className="flex flex-col-reverse select-none">
      {/* ── Bar (always visible — acts as the toggle) ── */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls="participants-list"
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
          'hover:bg-accent text-muted-foreground hover:text-foreground'
        )}
      >
        <Users className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <span className="text-[11px] font-semibold uppercase tracking-wider flex-1">
          Participants
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
          {allUsers.length}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            isOpen ? 'rotate-180' : 'rotate-0'
          )}
          strokeWidth={2}
        />
      </button>

      {/* ── Drawer (appears above the bar due to flex-col-reverse) ── */}
      {isOpen && (
        <div
          id="participants-list"
          className="max-h-[50vh] overflow-y-auto border-b border-border p-2"
        >
          <div className="space-y-0.5">
            {allUsers.map((user) => (
              <div
                key={user.userId}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.username}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Online dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card bg-emerald-500" />
                </div>

                {/* Name */}
                <span className="text-xs text-foreground/85 truncate flex-1">
                  {user.username}
                  {user.isLocal && (
                    <span className="text-muted-foreground ml-1">(you)</span>
                  )}
                </span>

                {/* Cursor color dot */}
                <span
                  className="ml-auto w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: user.color }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
