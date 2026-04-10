'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // next-themes cannot know the user's theme preference during SSR — the
  // theme lives in localStorage, which only exists on the client. So
  // `resolvedTheme` is `undefined` on the server and gets a real value after
  // the client hydrates. That means any markup derived from `isDark`
  // (aria-label, icon rotation classes, onClick target) would differ
  // between the server HTML and the first client render, and React would
  // hydrate-mismatch on the `aria-label` attribute.
  //
  // The fix is to render a theme-agnostic placeholder until we're mounted
  // on the client. Before mount: fixed aria-label, disabled button, no
  // theme-dependent icon rotation. After mount: the real toggle.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const sharedClassName =
    'h-10 w-10 rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground'

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        aria-label="Toggle theme"
        className={sharedClassName}
        // suppressHydrationWarning is a belt-and-braces measure: the markup
        // we render here is already deterministic, but next-themes injects
        // a `style="color-scheme: …"` on the <html> element which can also
        // leak into child trees in some setups. This silences the warning
        // for this subtree only.
        suppressHydrationWarning
      >
        <Sun className="h-[18px] w-[18px]" />
      </Button>
    )
  }

  const isDark = (resolvedTheme ?? theme) === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={sharedClassName}
    >
      <Sun
        className={cn(
          'h-[18px] w-[18px] transition-all',
          isDark ? '-rotate-90 scale-0' : 'rotate-0 scale-100'
        )}
      />
      <Moon
        className={cn(
          'absolute h-[18px] w-[18px] transition-all',
          isDark ? 'rotate-0 scale-100' : 'rotate-90 scale-0'
        )}
      />
    </Button>
  )
}
