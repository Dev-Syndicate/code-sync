'use client'

import { type ReactNode } from 'react'
// TODO: Import providers as they are created
// import { AuthProvider } from '@/components/providers/AuthProvider'
// import { ToastProvider } from '@/components/providers/ToastProvider'

interface Props {
  children: ReactNode
}

export function AppProviders({ children }: Props) {
  return (
    // TODO: Wrap with providers as they are created
    // <AuthProvider>
    //   <ToastProvider>
    //     {children}
    //   </ToastProvider>
    // </AuthProvider>
    <>{children}</>
  )
}
