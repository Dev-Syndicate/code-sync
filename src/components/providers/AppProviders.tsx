'use client'

import { type ReactNode } from 'react'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

interface Props {
  children: ReactNode
}

export function AppProviders({ children }: Props) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  )
}
