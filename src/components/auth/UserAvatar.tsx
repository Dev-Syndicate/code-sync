// Dev 1 — User avatar component
// Displays GitHub avatar with fallback initials
'use client'

interface UserAvatarProps {
  name: string
  avatar: string
  size?: number
  className?: string
}

/**
 * Shows a user's GitHub avatar with a fallback to their initials.
 */
export function UserAvatar({ name, avatar, size = 36, className }: UserAvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        background: 'var(--bg-elevated, #334155)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-primary, #f1f5f9)',
        fontSize: size * 0.38,
        fontWeight: 600,
        border: '2px solid var(--border-default, #334155)',
      }}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt={`${name}'s avatar`}
          width={size}
          height={size}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={(e) => {
            // On image load error, hide the image and show initials
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        initials
      )}
    </div>
  )
}
