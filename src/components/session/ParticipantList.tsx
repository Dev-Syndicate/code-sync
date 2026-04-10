'use client'

import Image from 'next/image'
import type { AwarenessUserState } from '@/lib/yjs/awareness'

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
    <div className="p-2">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
        Participants ({allUsers.length})
      </div>

      <div className="space-y-0.5 mt-1">
        {allUsers.map((user) => (
          <div
            key={user.userId}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
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
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#252526] bg-green-500"
              />
            </div>

            {/* Name */}
            <span className="text-xs text-white/80 truncate">
              {user.username}
              {user.isLocal && (
                <span className="text-white/30 ml-1">(you)</span>
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
  )
}
