import type { HTMLAttributes } from 'react'

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  rounded?: 's' | 'm' | 'l' | 'full'
}

export function Skeleton({ className = '', rounded = 'm', ...rest }: SkeletonProps) {
  const radiusMap = {
    s: 'var(--radius-s)',
    m: 'var(--radius-m)',
    l: 'var(--radius-l)',
    full: 'var(--radius-full)',
  } as const

  return (
    <div
      className={`relative overflow-hidden animate-pulse ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(0,0,0,0.03) 25%, rgba(0,0,0,0.06) 37%, rgba(0,0,0,0.03) 63%)',
        backgroundSize: '400% 100%',
        borderRadius: radiusMap[rounded],
        border: '1px solid var(--color-border)',
      }}
      {...rest}
    />
  )
}

