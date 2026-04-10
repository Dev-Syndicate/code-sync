// Dev 1 — Login page
'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { LoginButton } from '@/components/auth/LoginButton'

function LoginContent() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Redirect to dashboard (or original destination) if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      const redirect = searchParams.get('redirect') ?? '/dashboard'
      router.replace(redirect)
    }
  }, [isAuthenticated, loading, router, searchParams])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
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
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: '420px',
          width: '100%',
          padding: '48px 40px',
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
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
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {'</>'}
          </div>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '-0.5px',
            }}
          >
            CodeSync
          </span>
        </div>

        <h1
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#f1f5f9',
            marginBottom: '8px',
          }}
        >
          Welcome back
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#94a3b8',
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
            color: '#475569',
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
            background: '#0f172a',
            color: '#94a3b8',
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
