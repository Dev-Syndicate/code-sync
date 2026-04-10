'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Code2,
  GitBranch,
  Keyboard,
  LifeBuoy,
  MessageSquare,
  MousePointer2,
  Play,
  Save,
  Share2,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

import { Sidebar } from '@/components/dashboard/Sidebar'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const STEPS = [
  {
    icon: GithubIcon,
    title: 'Connect a repository',
    body: 'Sign in with GitHub and CodeSync surfaces every repo you have access to. Pin the ones you work in most so they live at the top of your dashboard.',
  },
  {
    icon: Play,
    title: 'Start a session',
    body: 'Click any repository to spin up a live session. CodeSync clones the file tree into a Yjs document so anyone you invite can edit alongside you in real time.',
  },
  {
    icon: Share2,
    title: 'Invite your collaborators',
    body: 'Use the Share action in the editor toolbar to copy a session link. Anyone with the link and a GitHub account can join — no extra accounts to manage.',
  },
  {
    icon: Save,
    title: 'Commit and push',
    body: 'When you are happy with the changes, open the Commit panel, write a message, and push back to GitHub. CodeSync uses your own OAuth token so the commit is authored by you.',
  },
] as const

const FEATURES = [
  {
    icon: Users,
    title: 'Live multiplayer editing',
    body: 'See cursors, selections, and edits from every collaborator the moment they happen — powered by Yjs and a dedicated WebSocket relay.',
  },
  {
    icon: GitBranch,
    title: 'GitHub-native workflow',
    body: 'Browse repos, open files, and push commits without leaving the editor. CodeSync never holds your code hostage.',
  },
  {
    icon: MessageSquare,
    title: 'In-session chat',
    body: 'Talk through changes with the chat panel beside the editor. Messages live with the session, not in a separate tool.',
  },
  {
    icon: MousePointer2,
    title: 'Presence and awareness',
    body: 'Each collaborator gets a colored cursor, name tag, and live status so you always know who is in the room.',
  },
  {
    icon: Zap,
    title: 'Zero setup',
    body: 'No installs, no extensions, no environment to configure. A modern browser is all anyone needs to join.',
  },
  {
    icon: Sparkles,
    title: 'Drafts and revert',
    body: 'CodeSync remembers your last save. Revert the room back to a known-good state without rewriting Git history.',
  },
] as const

const SHORTCUTS = [
  { keys: ['Ctrl', 'S'], label: 'Save the current draft to the session' },
  { keys: ['Ctrl', 'P'], label: 'Quick-open a file from the tree' },
  { keys: ['Ctrl', 'K'], label: 'Open the command palette' },
  { keys: ['Ctrl', '/'], label: 'Toggle line comment' },
  { keys: ['Esc'], label: 'Close any open dialog' },
] as const

const FAQS = [
  {
    q: 'Where is my code stored?',
    a: 'Your code lives in GitHub. CodeSync only holds the in-flight collaborative document for the duration of an active session, plus session metadata in Firestore so you can rejoin.',
  },
  {
    q: 'Who can see a session?',
    a: 'Only people who have the session link AND are signed in with GitHub. Sessions are not publicly listed anywhere.',
  },
  {
    q: 'Does CodeSync push commits on my behalf?',
    a: 'Only when you press Commit. The commit is authored with your GitHub identity using the OAuth token you granted at sign-in.',
  },
  {
    q: 'What happens if I lose connection?',
    a: 'Yjs keeps your local edits in memory and replays them when you reconnect. Your collaborators see you go offline, then come back.',
  },
] as const

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <Sidebar />

        <div className="flex-1 lg:pl-[240px]">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
            <div className="flex h-[72px] items-center justify-between gap-4 px-6 sm:px-8">
              <div className="flex items-center gap-2.5 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-500">
                  <Code2 className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
                </div>
                <span className="text-lg font-extrabold">CodeSync</span>
              </div>

              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:inline-flex"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>

              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* Page body */}
          <main className="mx-auto max-w-5xl px-6 py-10 sm:px-8 lg:py-14">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-emerald-50 via-background to-emerald-50/30 px-8 py-12 dark:from-emerald-950/30 dark:via-background dark:to-emerald-950/10 sm:px-12 sm:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, transparent 70%)',
                }}
              />
              <div className="relative max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 backdrop-blur-sm dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <LifeBuoy className="size-3.5" />
                  Help &amp; Walkthrough
                </div>
                <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  Everything you need to start{' '}
                  <span className="bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent">
                    coding together
                  </span>
                  .
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                  CodeSync turns any GitHub repository into a live, multiplayer
                  workspace. This page walks you through how it works, the
                  features that make it useful, and the shortcuts that make it
                  fast.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg" className="rounded-full">
                    <Link href="/dashboard">
                      <Play className="size-4" />
                      Go to Dashboard
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-full"
                  >
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <GithubIcon className="size-4" />
                      View on GitHub
                      <ArrowUpRight className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </section>

            {/* Quickstart */}
            <section className="mt-16">
              <div className="mb-8 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                    Quickstart
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    From sign-in to first commit
                  </h2>
                </div>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  4 steps · about 2 minutes
                </span>
              </div>

              <ol className="grid gap-4 sm:grid-cols-2">
                {STEPS.map((step, i) => {
                  const Icon = step.icon
                  return (
                    <li key={step.title}>
                      <Card className="group relative h-full gap-3 overflow-hidden border-border/60 px-6 py-6 transition-colors hover:border-emerald-300/60 dark:hover:border-emerald-800/60">
                        <div className="flex items-center justify-between">
                          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            <Icon className="size-5" />
                          </div>
                          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Step {String(i + 1).padStart(2, '0')}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {step.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                      </Card>
                    </li>
                  )
                })}
              </ol>
            </section>

            {/* Feature grid */}
            <section className="mt-20">
              <div className="mb-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  What you get
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Built for real-time, built for GitHub
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <div
                      key={feature.title}
                      className="group rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-emerald-300/60 dark:hover:border-emerald-800/60"
                    >
                      <div className="mb-4 flex size-9 items-center justify-center rounded-lg border border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Icon className="size-[18px]" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {feature.body}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Shortcuts + FAQ */}
            <section className="mt-20 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
              {/* Shortcuts */}
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground">
                    <Keyboard className="size-[18px]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                      Shortcuts
                    </p>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      Keyboard shortcuts
                    </h2>
                  </div>
                </div>

                <Card className="gap-0 divide-y divide-border/60 border-border/60 py-0">
                  {SHORTCUTS.map((shortcut) => (
                    <div
                      key={shortcut.label}
                      className="flex items-center justify-between gap-4 px-5 py-3.5"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {shortcut.keys.map((key, i) => (
                          <span key={`${shortcut.label}-${i}`} className="flex items-center gap-1.5">
                            <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border/70 bg-muted/40 px-1.5 font-mono text-[11px] font-semibold text-foreground shadow-sm">
                              {key}
                            </kbd>
                            {i < shortcut.keys.length - 1 ? (
                              <span className="text-xs text-muted-foreground">+</span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </Card>
              </div>

              {/* FAQ */}
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground">
                    <BookOpen className="size-[18px]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                      FAQ
                    </p>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      Frequently asked
                    </h2>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {FAQS.map((faq) => (
                    <details
                      key={faq.q}
                      className="group rounded-xl border border-border/60 bg-card px-5 py-4 transition-colors open:border-emerald-300/60 dark:open:border-emerald-800/60"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground">
                        {faq.q}
                        <span className="text-emerald-700 transition-transform group-open:rotate-45 dark:text-emerald-400">
                          +
                        </span>
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {faq.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </section>

            <Separator className="my-16" />

            {/* Footer CTA */}
            <section className="rounded-2xl border border-border/60 bg-card p-8 text-center sm:p-10">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Ready to start a session?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Pick a repository from your dashboard and invite a teammate.
                You will be editing together in seconds.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="rounded-full">
                  <Link href="/dashboard">
                    <Play className="size-4" />
                    Open Dashboard
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <Link href="/dashboard/profile">
                    Manage profile
                  </Link>
                </Button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
