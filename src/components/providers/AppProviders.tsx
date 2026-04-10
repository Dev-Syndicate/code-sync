'use client'

import { type ReactNode } from 'react'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

interface Props {
  children: ReactNode
}

export function AppProviders({ children }: Props) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
