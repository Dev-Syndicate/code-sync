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
        background: 'linear-gradient(135deg, #f6f7f9 0%, #ecfdf5 50%, #f6f7f9 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Primary forest-green glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(15, 81, 50, 0.12) 0%, transparent 70%)',
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
          background: 'radial-gradient(circle, rgba(187, 247, 208, 0.35) 0%, transparent 70%)',
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
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e5e7eb',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(17, 24, 39, 0.08), 0 8px 16px rgba(17, 24, 39, 0.04)',
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
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0f5132, #22c55e)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 700,
              color: '#ffffff',
              boxShadow: '0 8px 24px -8px rgba(15, 81, 50, 0.4)',
            }}
          >
            {'</>'}
          </div>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#111827',
              letterSpacing: '-0.5px',
            }}
          >
            CodeSync
          </span>
        </div>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#111827',
            marginBottom: '8px',
            letterSpacing: '-0.3px',
          }}
        >
          Welcome back
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#6b7280',
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
            color: '#9ca3af',
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
            background: '#f6f7f9',
            color: '#6b7280',
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
