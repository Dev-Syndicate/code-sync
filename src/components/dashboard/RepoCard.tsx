'use client'

import { useState } from 'react'
import type { GitHubRepo } from '@/types'

// ── Language color map (matches GitHub's language colors) ──
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Ruby: '#701516',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
  Shell: '#89e051',
}

function getLanguageColor(language: string | null): string {
  if (!language) return '#6b7280'
  return LANGUAGE_COLORS[language] ?? '#6b7280'
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface RepoCardProps {
  repo: GitHubRepo
  viewMode: 'grid' | 'list'
  onStartSession: (repo: GitHubRepo) => void
}

export function RepoCard({ repo, viewMode, onStartSession }: RepoCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const isGrid = viewMode === 'grid'

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: isHovered
          ? 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(16,185,129,0.05))'
          : '#1e293b',
        border: `1px solid ${isHovered ? '#3b82f6' : '#334155'}`,
        borderRadius: '12px',
        padding: isGrid ? '20px' : '16px 20px',
        display: isGrid ? 'flex' : 'flex',
        flexDirection: isGrid ? 'column' : 'row',
        alignItems: isGrid ? 'stretch' : 'center',
        gap: isGrid ? '14px' : '20px',
        transition: 'all 250ms ease',
        cursor: 'pointer',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered
          ? '0 8px 20px rgba(0,0,0,0.4)'
          : '0 1px 3px rgba(0,0,0,0.2)',
      }}
      onClick={() => onStartSession(repo)}
    >
      {/* Repo info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
          {/* Repo icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#94a3b8" style={{ flexShrink: 0 }}>
            <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
          </svg>

          <span style={{
            color: '#60a5fa',
            fontWeight: 600,
            fontSize: '15px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {repo.name}
          </span>

          {/* Visibility badge */}
          <span style={{
            fontSize: '11px',
            color: '#94a3b8',
            border: '1px solid #475569',
            borderRadius: '9999px',
            padding: '1px 8px',
            fontWeight: 500,
          }}>
            {repo.private ? 'Private' : 'Public'}
          </span>

          {repo.fork && (
            <span style={{
              fontSize: '11px',
              color: '#94a3b8',
              border: '1px solid #475569',
              borderRadius: '9999px',
              padding: '1px 8px',
              fontWeight: 500,
            }}>
              Fork
            </span>
          )}
        </div>

        {/* Description */}
        {repo.description && (
          <p style={{
            color: '#94a3b8',
            fontSize: '13px',
            lineHeight: '1.5',
            margin: '0 0 10px 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: isGrid ? 2 : 1,
            WebkitBoxOrient: 'vertical',
          }}>
            {repo.description}
          </p>
        )}

        {/* Meta row: language + stars + updated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {repo.language && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#94a3b8' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: getLanguageColor(repo.language),
                display: 'inline-block',
              }} />
              {repo.language}
            </span>
          )}

          {repo.stargazers_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="#94a3b8">
                <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
              </svg>
              {repo.stargazers_count}
            </span>
          )}

          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Updated {getRelativeTime(repo.updated_at)}
          </span>
        </div>
      </div>

      {/* Start session button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onStartSession(repo)
        }}
        style={{
          background: isHovered
            ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
            : 'transparent',
          color: isHovered ? '#ffffff' : '#3b82f6',
          border: isHovered ? 'none' : '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 200ms ease',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Start Session
      </button>
    </div>
  )
}
