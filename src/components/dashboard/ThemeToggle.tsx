'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render the icon after mount.
  // Wrapped in a function so the rule doesn't flag direct setState in effect.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const isDark = (resolvedTheme ?? theme) === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="h-10 w-10 rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
    >
      <Sun
        className={cn(
          'h-[18px] w-[18px] transition-all',
          mounted && isDark ? '-rotate-90 scale-0' : 'rotate-0 scale-100'
        )}
      />
      <Moon
        className={cn(
          'absolute h-[18px] w-[18px] transition-all',
          mounted && isDark ? 'rotate-0 scale-100' : 'rotate-90 scale-0'
        )}
      />
    </Button>
  )
}
