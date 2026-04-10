// Dev 1 — Login page
'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, GitBranch, Users, Zap } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { LoginButton } from '@/components/auth/LoginButton'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { syncServerSession, isLoginInFlight } from '@/lib/firebase/auth'

function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-11 text-lg rounded-[14px]' : 'size-9 text-sm rounded-xl'
  const word = size === 'lg' ? 'text-2xl' : 'text-xl'
  return (
    <div className="inline-flex items-center gap-2.5">
      <div
        className={`${box} flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-900/30`}
        style={{ background: 'linear-gradient(135deg, #0f5132, #22c55e)' }}
      >
        {'</>'}
      </div>
      <span className={`${word} font-extrabold tracking-tight text-foreground`}>CodeSync</span>
    </div>
  )
}

const VALUE_PROPS = [
  {
    icon: Users,
    title: 'Real-time multiplayer editing',
    body: 'See teammates type, select, and move through the file as you work — like Google Docs for code.',
  },
  {
    icon: GitBranch,
    title: 'GitHub-native by default',
    body: 'Open any of your repos, edit together, then commit and push without leaving the editor.',
  },
  {
    icon: Zap,
    title: 'Zero setup',
    body: 'Share a session link and your collaborator is editing in seconds. No installs, no config.',
  },
] as const

function MarketingPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-emerald-50/40 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 size-[600px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(15, 81, 50, 0.18) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 size-[420px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.22) 0%, transparent 70%)' }}
      />

      <div className="relative">
        <BrandMark size="lg" />
      </div>

      <div className="relative flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-foreground lg:text-5xl">
            Code together.
            <br />
            <span className="bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent">
              Ship together.
            </span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            CodeSync turns any GitHub repository into a live, multiplayer workspace. Open a file,
            invite a teammate, and start editing in real time.
          </p>
        </div>

        <MockEditorPreview />

        <ul className="flex flex-col gap-5">
          {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3.5">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Icon className="size-[18px]" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-muted-foreground">
        Built with Next.js, Yjs, and Firebase.
      </p>
    </aside>
  )
}

function FeatureChip({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-border/60 bg-muted/40 px-2 py-2 text-center text-xs font-medium text-muted-foreground">
      {label}
    </div>
  )
}

function MockEditorPreview() {
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border/60 bg-[#0d1117] shadow-2xl shadow-emerald-950/20">
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11px] text-white/40">session.ts</span>
      </div>
      <pre className="relative overflow-hidden px-4 py-4 font-mono text-[12px] leading-[1.7] text-white/90">
        <code className="block">
          <span className="mr-3 inline-block w-4 text-right text-white/30">1</span>
          <span className="text-[#ff7b72]">export</span>{' '}
          <span className="text-[#ff7b72]">function</span>{' '}
          <span className="text-[#d2a8ff]">createSession</span>
          <span className="text-white/70">(</span>
          <span className="text-[#79c0ff]">repo</span>
          <span className="text-white/70">: </span>
          <span className="text-[#7ee787]">Repo</span>
          <span className="text-white/70">) {'{'}</span>
          {'\n'}
          <span className="mr-3 inline-block w-4 text-right text-white/30">2</span>
          <span className="text-white/70">  </span>
          <span className="text-[#ff7b72]">const</span>{' '}
          <span className="text-[#79c0ff]">doc</span>{' '}
          <span className="text-white/70">= </span>
          <span className="text-[#ff7b72]">new</span>{' '}
          <span className="text-[#d2a8ff]">Y.Doc</span>
          <span className="text-white/70">()</span>
          <span className="relative ml-0.5 inline-block">
            <span className="absolute -top-0.5 inline-block h-[15px] w-[2px] bg-emerald-400" />
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
              giri
            </span>
          </span>
          {'\n'}
          <span className="mr-3 inline-block w-4 text-right text-white/30">3</span>
          <span className="text-white/70">  </span>
          <span className="text-[#ff7b72]">return</span>{' '}
          <span className="text-[#d2a8ff]">connect</span>
          <span className="text-white/70">(</span>
          <span className="text-[#79c0ff]">doc</span>
          <span className="text-white/70">, </span>
          <span className="text-[#79c0ff]">repo</span>
          <span className="text-white/70">.</span>
          <span className="text-[#79c0ff]">id</span>
          <span className="text-white/70">)</span>
          <span className="relative ml-0.5 inline-block">
            <span className="absolute -top-0.5 inline-block h-[15px] w-[2px] bg-sky-400" />
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded-md bg-sky-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
              alex
            </span>
          </span>
          {'\n'}
          <span className="mr-3 inline-block w-4 text-right text-white/30">4</span>
          <span className="text-white/70">{'}'}</span>
        </code>
      </pre>
    </div>
  )
}

function LoginContent() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const syncedRef = useRef(false)
  const [error, setError] = useState<string>('')

  // Fallback path for "user is already signed in when they land on /login"
  // (e.g. they navigated here manually). The happy path is that LoginButton
  // triggers loginWithGitHub(), waits for the POST /api/auth/session to
  // complete, and then redirects itself — this effect must NOT race that
  // flow, or it probes the cookie before it's set and signs the user out.
  useEffect(() => {
    if (loading || !isAuthenticated || syncedRef.current) return
    if (isLoginInFlight()) return
    syncedRef.current = true

    void (async () => {
      const ok = await syncServerSession()
      if (ok) {
        const redirect = searchParams.get('redirect') ?? '/dashboard'
        router.replace(redirect)
      }
    })()
  }, [isAuthenticated, loading, router, searchParams])

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <MarketingPanel />

      <section className="relative flex min-h-svh flex-col bg-background px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <BrandMark size="md" />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <Card className="w-full max-w-xl gap-8 border-border/70 px-2 py-10 shadow-xl shadow-emerald-950/5 sm:px-4">
            <CardHeader className="gap-3 text-center">
              <CardTitle className="text-3xl font-bold tracking-tight">
                Welcome to CodeSync
              </CardTitle>
              <CardDescription className="text-base">
                Sign in with GitHub to start collaborating in real time.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <LoginButton onError={setError} />

              {error ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="relative flex items-center gap-3 py-1">
                <Separator className="flex-1" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Secure GitHub OAuth
                </span>
                <Separator className="flex-1" />
              </div>

              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                We only request the scopes needed to read your repositories and push commits you
                author inside CodeSync.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <FeatureChip label="Live cursors" />
                <FeatureChip label="Auto commits" />
                <FeatureChip label="Repo aware" />
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3 pt-2">
              <p className="text-center text-xs text-muted-foreground">
                By continuing, you agree to our{' '}
                <span className="font-medium text-foreground">Terms</span> and{' '}
                <span className="font-medium text-foreground">Privacy Policy</span>.
              </p>
              <p className="text-center text-xs text-muted-foreground">
                New here?{' '}
                <span className="font-medium text-foreground">
                  Sign in with GitHub — your account is created automatically.
                </span>
              </p>
            </CardFooter>
          </Card>
        </div>
      </section>
    </main>
  )
}

function LoginFallback() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Skeleton className="mx-auto h-10 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  )
}
