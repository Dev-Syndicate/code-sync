// Dev 1 — ToastProvider
// Global toast notification container
'use client'

import { type ReactNode } from 'react'
import { useToastStore } from '@/store/toastStore'
import { Toast } from '@/components/ui/Toast'

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, removeToast } = useToastStore()

  return (
    <>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div
        id="toast-container"
        className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onDismiss={removeToast}
          />
        ))}
      </div>
    </>
  )
}
