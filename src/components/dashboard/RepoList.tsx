'use client'

import type { GitHubRepo } from '@/types'
import { RepoCard } from './RepoCard'

interface RepoListProps {
  repos: GitHubRepo[]
  loading: boolean
  error: string | null
  viewMode: 'grid' | 'list'
  onStartSession: (repo: GitHubRepo) => void
  onRetry: () => void
}

function SkeletonCard({ viewMode }: { viewMode: 'grid' | 'list' }) {
  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: viewMode === 'grid' ? '20px' : '16px 20px',
        display: 'flex',
        flexDirection: viewMode === 'grid' ? 'column' : 'row',
        gap: viewMode === 'grid' ? '14px' : '20px',
        alignItems: viewMode === 'grid' ? 'stretch' : 'center',
        animation: 'pulse 2s ease-in-out infinite',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ height: '16px', width: '60%', background: '#334155', borderRadius: '4px', marginBottom: '10px' }} />
        <div style={{ height: '12px', width: '90%', background: '#334155', borderRadius: '4px', marginBottom: '8px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ height: '10px', width: '60px', background: '#334155', borderRadius: '4px' }} />
          <div style={{ height: '10px', width: '40px', background: '#334155', borderRadius: '4px' }} />
        </div>
      </div>
      {viewMode === 'grid' && (
        <div style={{ height: '36px', background: '#334155', borderRadius: '8px' }} />
      )}
    </div>
  )
}

export function RepoList({ repos, loading, error, viewMode, onStartSession, onRetry }: RepoListProps) {
  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'grid'
            ? 'repeat(auto-fill, minmax(320px, 1fr))'
            : '1fr',
          gap: '16px',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} viewMode={viewMode} />
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
          Failed to load repositories
        </p>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
          {error}
        </p>
        <button
          onClick={onRetry}
          style={{
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 200ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
        >
          Try Again
        </button>
      </div>
    )
  }

  // Empty state
  if (repos.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(148, 163, 184, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="#475569">
            <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z" />
          </svg>
        </div>
        <p style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
          No repositories found
        </p>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          Try adjusting your search or filter criteria
        </p>
      </div>
    )
  }

  // Repo list/grid
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'grid'
          ? 'repeat(auto-fill, minmax(320px, 1fr))'
          : '1fr',
        gap: '16px',
      }}
    >
      {repos.map((repo) => (
        <RepoCard
          key={repo.id}
          repo={repo}
          viewMode={viewMode}
          onStartSession={onStartSession}
        />
      ))}
    </div>
  )
}
