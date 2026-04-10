'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRepos } from '@/hooks/useRepos'
import { useSessionStore } from '@/store/sessionStore'
import { RepoList } from '@/components/dashboard/RepoList'
import { CreateSession } from '@/components/dashboard/CreateSession'
import type { GitHubRepo, Session } from '@/types'

// ── Active session card ──
function SessionCard({ session }: { session: Session }) {
  const [hovered, setHovered] = useState(false)
  const participantList = Object.values(session.participants)
  const participantCount = participantList.length

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(37,99,235,0.05))'
          : '#1e293b',
        border: `1px solid ${hovered ? '#10b981' : '#334155'}`,
        borderRadius: '12px',
        padding: '16px 20px',
        transition: 'all 250ms ease',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
      onClick={() => {
        window.location.href = `/session/${session.id}`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Live indicator */}
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px rgba(34,197,94,0.5)',
            animation: 'livePulse 2s ease-in-out infinite',
            display: 'inline-block',
          }} />
          <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
            {session.repo}
          </span>
        </div>
        <span style={{
          fontSize: '11px',
          color: '#10b981',
          background: 'rgba(16,185,129,0.12)',
          borderRadius: '6px',
          padding: '2px 8px',
          fontWeight: 600,
        }}>
          Live
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Stacked participant avatars */}
          {participantList.slice(0, 3).map((p, i) => (
            <div
              key={i}
              title={p.username}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '2px solid #1e293b',
                background: p.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                marginLeft: i > 0 ? '-8px' : '0',
                zIndex: 3 - i,
                position: 'relative',
              }}
            >
              {p.username.charAt(0).toUpperCase()}
            </div>
          ))}
          <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>
            {participantCount}/{session.maxParticipants}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#64748b">
            <path d="M5.22 14.78a.75.75 0 001.06-1.06L4.56 12h8.19a.75.75 0 000-1.5H4.56l1.72-1.72a.75.75 0 00-1.06-1.06l-3 3a.75.75 0 000 1.06l3 3zm5.56-6.5a.75.75 0 11-1.06-1.06l1.72-1.72H3.25a.75.75 0 010-1.5h8.19L9.72 2.28a.75.75 0 011.06-1.06l3 3a.75.75 0 010 1.06l-3 3z" />
          </svg>
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            {session.branch}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const {
    repos,
    loading,
    error,
    searchQuery,
    languageFilter,
    viewMode,
    languages,
    setSearchQuery,
    setLanguageFilter,
    setViewMode,
    refetch,
  } = useRepos()

  const { sessions, setSessions, setLoading: setSessionsLoading } = useSessionStore()
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [sessionsLoading, setLocalSessionsLoading] = useState(true)

  // Fetch active sessions from the real API
  useEffect(() => {
    let cancelled = false

    async function fetchSessions() {
      setLocalSessionsLoading(true)
      try {
        const res = await fetch('/api/sessions')
        const json = await res.json()

        if (!cancelled && json.success) {
          setSessions(json.data ?? [])
        }
      } catch (err) {
        console.error('[DashboardPage] Failed to fetch sessions:', err)
      } finally {
        if (!cancelled) {
          setLocalSessionsLoading(false)
        }
      }
    }

    fetchSessions()

    return () => {
      cancelled = true
    }
  }, [setSessions])

  const activeSessions = sessions.filter((s) => s.active)

  function handleStartSession(repo: GitHubRepo) {
    setSelectedRepo(repo)
    setIsCreateOpen(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      {/* ── Header Bar ── */}
      <header style={{
        borderBottom: '1px solid #1e293b',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
        background: 'rgba(15, 23, 42, 0.8)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Logo */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            <span style={{ color: '#60a5fa' }}>Code</span>
            <span style={{ color: '#f1f5f9' }}>Sync</span>
          </span>
        </div>

        {/* User info + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user && (
            <>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                {user.username}
              </span>
              <button
                onClick={logout}
                style={{
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ef4444'
                  e.currentTarget.style.color = '#ef4444'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#334155'
                  e.currentTarget.style.color = '#94a3b8'
                }}
              >
                Sign out
              </button>
            </>
          )}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: user?.avatar
              ? `url(${user.avatar}) center/cover`
              : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            overflow: 'hidden',
          }}>
            {!user?.avatar && (user?.username?.charAt(0).toUpperCase() ?? 'U')}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px' }}>
        {/* Greeting */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '26px',
            fontWeight: 800,
            margin: '0 0 6px 0',
            letterSpacing: '-0.5px',
          }}>
            {user ? (
              <>Welcome back, <span style={{ color: '#60a5fa' }}>{user.username}</span></>
            ) : (
              <>Welcome to <span style={{ color: '#60a5fa' }}>CodeSync</span></>
            )}
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
            Select a repository to start a collaborative coding session
          </p>
        </div>

        {/* ── Active Sessions Section ── */}
        {!sessionsLoading && activeSessions.length > 0 && (
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                Active Sessions
              </h2>
              <span style={{
                fontSize: '12px',
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
                borderRadius: '9999px',
                padding: '2px 8px',
                fontWeight: 600,
              }}>
                {activeSessions.length}
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '12px',
            }}>
              {activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* ── Repositories Section ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Your Repositories
            </h2>
            {!loading && (
              <span style={{
                fontSize: '12px',
                background: 'rgba(148,163,184,0.1)',
                color: '#94a3b8',
                borderRadius: '9999px',
                padding: '2px 8px',
                fontWeight: 600,
              }}>
                {repos.length}
              </span>
            )}
          </div>

          {/* Toolbar: Search + Filter + View toggle */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '360px' }}>
              <svg
                width="16" height="16"
                viewBox="0 0 24 24"
                fill="none" stroke="#64748b"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="repo-search"
                type="text"
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  color: '#f1f5f9',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '10px 12px 10px 38px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 200ms',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#334155')}
              />
            </div>

            {/* Language filter */}
            <select
              id="language-filter"
              value={languageFilter ?? ''}
              onChange={(e) => setLanguageFilter(e.target.value || null)}
              style={{
                background: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer',
                minWidth: '140px',
              }}
            >
              <option value="">All Languages</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>

            <div style={{ flex: 1 }} />

            {/* View mode toggle */}
            <div style={{
              display: 'flex',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <button
                id="view-grid"
                onClick={() => setViewMode('grid')}
                title="Grid view"
                style={{
                  padding: '8px 12px',
                  background: viewMode === 'grid' ? '#334155' : 'transparent',
                  border: 'none',
                  color: viewMode === 'grid' ? '#f1f5f9' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 200ms',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                id="view-list"
                onClick={() => setViewMode('list')}
                title="List view"
                style={{
                  padding: '8px 12px',
                  background: viewMode === 'list' ? '#334155' : 'transparent',
                  border: 'none',
                  color: viewMode === 'list' ? '#f1f5f9' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 200ms',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="4" width="18" height="4" rx="1" />
                  <rect x="3" y="10" width="18" height="4" rx="1" />
                  <rect x="3" y="16" width="18" height="4" rx="1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Repo list/grid */}
          <RepoList
            repos={repos}
            loading={loading}
            error={error}
            viewMode={viewMode}
            onStartSession={handleStartSession}
            onRetry={refetch}
          />
        </div>
      </main>

      {/* ── Create Session Modal ── */}
      {selectedRepo && (
        <CreateSession
          repo={selectedRepo}
          isOpen={isCreateOpen}
          onClose={() => {
            setIsCreateOpen(false)
            setSelectedRepo(null)
          }}
        />
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
