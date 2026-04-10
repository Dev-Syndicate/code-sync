'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GitHubRepo } from '@/types'
import { createSession } from '@/lib/session/create'
import { useAuth } from '@/hooks/useAuth'
import { useSessionStore } from '@/store/sessionStore'

interface CreateSessionProps {
  repo: GitHubRepo
  isOpen: boolean
  onClose: () => void
}

export function CreateSession({ repo, isOpen, onClose }: CreateSessionProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { addSession } = useSessionStore()

  const [branch, setBranch] = useState(repo.default_branch)
  const [maxParticipants, setMaxParticipants] = useState(4)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock branches — replaced when Dev 4's branch API is ready
  const branches = [repo.default_branch, 'develop', 'feature/dev1-auth', 'feature/dev2-dashboard']

  if (!isOpen) return null

  async function handleCreate() {
    setIsCreating(true)
    setError(null)

    try {
      const session = await createSession({
        repo: repo.name,
        repoOwner: repo.owner.login,
        repoUrl: repo.html_url,
        branch,
        owner: user?.uid ?? 'mock-user-id',
        files: [],
        maxParticipants,
      })

      if (session) {
        addSession(session)
        onClose()
        router.push(`/session/${session.id}`)
      } else {
        setError('Failed to create session. Please try again.')
      }
    } catch (err) {
      setError('An unexpected error occurred.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          animation: 'fadeIn 200ms ease',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '28px',
          width: '90%',
          maxWidth: '480px',
          zIndex: 101,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'slideUp 250ms ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 700, margin: 0 }}>
            Create Coding Session
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              transition: 'color 200ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Repo info card */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="#60a5fa">
            <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z" />
          </svg>
          <div>
            <p style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: 0 }}>
              {repo.owner.login}/{repo.name}
            </p>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>
              {repo.description || 'No description'}
            </p>
          </div>
        </div>

        {/* Branch selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Branch
          </label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            style={{
              width: '100%',
              background: '#0f172a',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
            }}
          >
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Max participants */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Max Participants
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setMaxParticipants(n)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: maxParticipants === n ? '2px solid #3b82f6' : '1px solid #334155',
                  background: maxParticipants === n ? 'rgba(59, 130, 246, 0.15)' : '#0f172a',
                  color: maxParticipants === n ? '#60a5fa' : '#94a3b8',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            color: '#fca5a5',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isCreating ? 'not-allowed' : 'pointer',
              transition: 'all 200ms ease',
              opacity: isCreating ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: isCreating
                ? '#1e40af'
                : 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: isCreating ? 'not-allowed' : 'pointer',
              transition: 'all 200ms ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isCreating ? (
              <>
                <span style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  display: 'inline-block',
                }} />
                Creating...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Start Session
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
