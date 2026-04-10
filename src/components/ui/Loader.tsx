'use client'

interface LoaderProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
} as const

export function Loader({ text, size = 'md', className = '' }: LoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeMap[size]} rounded-full border-[var(--foreground)]/20 border-t-[var(--foreground)] animate-spin`}
      />
      {text && (
        <p className="text-sm text-[var(--foreground)]/60 animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}
