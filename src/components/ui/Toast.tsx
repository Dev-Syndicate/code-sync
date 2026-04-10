// Dev 1 — Toast UI component
// Individual toast notification with dismiss and auto-fade
'use client'

import { useEffect, useState } from 'react'
import type { ToastType } from '@/types'

interface ToastProps {
  id: string
  type: ToastType
  message: string
  onDismiss: (id: string) => void
}

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'rgba(34, 197, 94, 0.15)',
    border: '#22c55e',
    icon: '✓',
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.15)',
    border: '#ef4444',
    icon: '✕',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.15)',
    border: '#f59e0b',
    icon: '⚠',
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: '#3b82f6',
    icon: 'ℹ',
  },
}

export function Toast({ id, type, message, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  const style = TOAST_STYLES[type]

  useEffect(() => {
    // Trigger entry animation
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => onDismiss(id), 200)
  }

  return (
    <div
      role="alert"
      className="pointer-events-auto"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '8px',
        background: '#ffffff',
        borderLeft: `3px solid ${style.border}`,
        border: '1px solid #e5e7eb',
        borderLeftWidth: '3px',
        borderLeftColor: style.border,
        boxShadow: '0 12px 28px rgba(17, 24, 39, 0.08)',
        color: '#111827',
        fontSize: '14px',
        minWidth: '300px',
        maxWidth: '420px',
        transform: isVisible ? 'translateX(0)' : 'translateX(120%)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 200ms ease',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: style.border,
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {style.icon}
      </span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss toast"
        style={{
          background: 'none',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '4px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
