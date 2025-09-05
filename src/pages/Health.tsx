import { useEffect, useState } from 'react'

export default function Health() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // Ignore localStorage errors
    }
  }, [theme])

  const status = {
    status: 'ok',
    time: new Date().toISOString(),
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Health</h2>
        <button
          className="ui-btn ui-btn--ghost"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="ui-card">
          <h3 className="mb-2 text-lg font-medium">JSON</h3>
          <pre
            className="overflow-auto p-4 text-sm border"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-canvas)',
              borderRadius: 'var(--radius-s)',
            }}
          >
            {JSON.stringify(status, null, 2)}
          </pre>
        </div>

        <div className="ui-card">
          <h3 className="mb-2 text-lg font-medium">Tokens</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Token name="canvas" className="bg-[var(--color-canvas)]" />
            <Token name="surface" className="bg-[var(--color-surface)]" />
            <Token name="brand" className="bg-[var(--color-brand)]" />
            <Token name="fg" className="bg-[var(--color-fg)]" />
            <Token name="muted" className="bg-[var(--color-muted)]" />
            <Token name="border" className="bg-[var(--color-border)]" />
          </div>
        </div>

        <div className="ui-card">
          <h3 className="mb-2 text-lg font-medium">Radius + Shadow</h3>
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 border bg-[var(--color-surface)]"
              style={{
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-s)',
                boxShadow: 'var(--shadow-1)',
              }}
            />
            <div
              className="h-16 w-16 border bg-[var(--color-surface)]"
              style={{
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-m)',
                boxShadow: 'var(--shadow-2)',
              }}
            />
            <div
              className="h-16 w-16 border bg-[var(--color-surface)]"
              style={{
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-l)',
                boxShadow: 'var(--shadow-2)',
              }}
            />
            <div
              className="h-16 w-16 rounded-full border bg-[var(--color-surface)]"
              style={{
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-1)',
              }}
            />
          </div>
        </div>

        <div className="ui-card">
          <h3 className="mb-2 text-lg font-medium">Spacing + Motion</h3>
          <div className="flex items-end gap-4">
            <Bar label="1" className="h-6 w-6" />
            <Bar label="2" className="h-6 w-8" />
            <Bar label="3" className="h-6 w-12" />
            <Bar label="4" className="h-6 w-16" />
            <button className="ui-btn" onClick={(e) => bounce(e.currentTarget)}>
              Animate
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Token({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-8 w-8 border ${className}`}
        style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius-s)' }}
      />
      <span className="text-[var(--color-muted)]">{name}</span>
    </div>
  )
}

function Bar({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`bg-[var(--color-brand)] transition-transform ${className}`}
        style={{ borderRadius: 'var(--radius-s)', transitionDuration: 'var(--dur-fast)' }}
      />
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
    </div>
  )
}

function bounce(el: HTMLElement) {
  el.style.transitionDuration = 'var(--dur-std)'
  el.style.transform = 'translateY(-3px)'
  requestAnimationFrame(() => {
    setTimeout(() => {
      el.style.transform = 'translateY(0)'
      setTimeout(() => {
        el.style.transitionDuration = ''
      }, 260)
    }, 10)
  })
}
