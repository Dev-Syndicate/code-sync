// Dev 1 — Login page
'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { LoginButton } from '@/components/auth/LoginButton'
import { syncServerSession, isLoginInFlight } from '@/lib/firebase/auth'

function LoginContent() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const syncedRef = useRef(false)

  // Fallback path for "user is already signed in when they land on /login"
  // (e.g. they navigated here manually). The happy path is that LoginButton
  // triggers loginWithGitHub(), waits for the POST /api/auth/session to
  // complete, and then redirects itself — this effect must NOT race that
  // flow, or it probes the cookie before it's set and signs the user out.
  useEffect(() => {
    if (loading || !isAuthenticated || syncedRef.current) return
    // Don't interfere with an in-progress loginWithGitHub() — its own POST
    // will set the cookie, and LoginButton will redirect when it resolves.
    if (isLoginInFlight()) return
    syncedRef.current = true

    void (async () => {
      const ok = await syncServerSession()
      if (ok) {
        const redirect = searchParams.get('redirect') ?? '/dashboard'
        router.replace(redirect)
      }
      // If not ok, syncServerSession signed us out — useAuth will update,
      // isAuthenticated will become false, and the login button stays visible.
    })()
  }, [isAuthenticated, loading, router, searchParams])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #091413 0%, #102820 50%, #091413 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(64, 138, 113, 0.22) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Secondary mint glow */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '15%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(176, 228, 204, 0.08) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: '420px',
          width: '100%',
          padding: '48px 40px',
          background: 'rgba(15, 33, 28, 0.7)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(176, 228, 204, 0.08)',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(64, 138, 113, 0.08)',
        }}
      >
        {/* Logo / Branding */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #285A48, #408A71)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 700,
              color: '#B0E4CC',
              boxShadow: '0 8px 24px -8px rgba(64, 138, 113, 0.5)',
            }}
          >
            {'</>'}
          </div>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#e8f5f0',
              letterSpacing: '-0.5px',
            }}
          >
            <span style={{ color: '#B0E4CC' }}>Code</span>Sync
          </span>
        </div>

        <h1
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#e8f5f0',
            marginBottom: '8px',
          }}
        >
          Welcome back
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#8fb5a6',
            marginBottom: '36px',
            lineHeight: 1.6,
          }}
        >
          Sign in with your GitHub account to start
          <br />
          collaborating in real time.
        </p>

        {/* Login Button */}
        <LoginButton />

        {/* Footer note */}
        <p
          style={{
            fontSize: '12px',
            color: '#4f7367',
            marginTop: '28px',
            lineHeight: 1.5,
          }}
        >
          By continuing, you agree to grant CodeSync access
          <br />
          to your GitHub repositories.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#091413',
            color: '#8fb5a6',
          }}
        >
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
