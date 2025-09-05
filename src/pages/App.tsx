import { Link } from 'react-router-dom'
import { env } from '@/shared/env'
import AppLayout from '@/components/AppLayout'
import { Skeleton } from '@/components/Skeleton'

export default function App() {
  const Topbar = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-canvas)' }} />
        <div className="font-semibold tracking-tight">{env.VITE_APP_NAME}</div>
      </div>
      <nav className="flex items-center gap-4 text-sm">
        <Link to="/" className="hover:underline">Home</Link>
        <Link to="/health" className="hover:underline">Health</Link>
      </nav>
    </div>
  )

  const RightPanel = (
    <div className="space-y-4">
      <div className="ui-card">
        <h3 className="text-base font-medium mb-1">Coach</h3>
        <p className="text-sm text-[var(--color-muted)]">Hints, tips, and insights will appear here.</p>
      </div>
      <div className="ui-card">
        <h3 className="text-base font-medium mb-1">Moves</h3>
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
    </div>
  )

  const Footer = (
    <div className="flex items-center justify-between w-full">
      <span>Mode: {import.meta.env.MODE}</span>
      <span className="opacity-80">© {new Date().getFullYear()}</span>
    </div>
  )

  return (
    <AppLayout topbar={Topbar} right={RightPanel} footer={Footer}>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="text-[var(--color-muted)]">This area hosts the chess board.</p>
        <div className="ui-card">
          <div className="aspect-square w-full max-w-[640px] mx-auto border bg-[var(--color-surface)]" style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius-l)' }} />
        </div>
      </div>
    </AppLayout>
  )
}
