import type { ReactNode } from 'react'
import { Skeleton } from './Skeleton'

type AppLayoutProps = {
  topbar?: ReactNode
  right?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  loading?: boolean
}

export default function AppLayout({ topbar, right, footer, children, loading = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr,auto]" style={{ background: 'var(--color-canvas)', color: 'var(--color-fg)' }}>
      <header
        className="sticky top-0 z-10 border-b"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          {loading && !topbar ? (
            <Skeleton className="h-8 w-56" />
          ) : topbar ? (
            topbar
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-canvas)' }} />
              <div className="font-medium">App</div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-4 lg:py-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6">
          <section className="min-w-0 flex-1">
            {loading && !children ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-[420px] w-full" rounded="l" />
              </div>
            ) : children ? (
              children
            ) : (
              <div className="ui-card">
                <h2 className="text-lg font-medium mb-2">Main</h2>
                <p className="text-sm text-[var(--color-muted)]">Primary content area</p>
              </div>
            )}
          </section>

          <aside className="mt-4 lg:mt-0 lg:ml-2 w-full lg:w-[360px] shrink-0">
            {loading && !right ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : right ? (
              right
            ) : (
              <div className="ui-card">
                <h3 className="text-base font-medium mb-2">Right Panel</h3>
                <p className="text-sm text-[var(--color-muted)]">Secondary panel content</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 text-sm text-[var(--color-muted)] flex items-center justify-between">
          {loading && !footer ? (
            <Skeleton className="h-4 w-48" />
          ) : footer ? (
            footer
          ) : (
            <div>Footer</div>
          )}
        </div>
      </footer>
    </div>
  )
}

