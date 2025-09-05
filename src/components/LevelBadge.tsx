import { useEffect, useState } from 'react'
import { settingsDAO, type Settings } from '@/db/indexeddb'

export function LevelBadge() {
  const [level, setLevel] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const s = await settingsDAO.getDefault()
        if (mounted) setLevel(s?.difficulty ?? 3)
      } catch {
        if (mounted) setLevel(3)
      }
    }
    load()

    const onUpdated = (e: Event) => {
      const ce = e as CustomEvent<Settings>
      if (ce.detail && typeof ce.detail.difficulty === 'number') {
        setLevel(ce.detail.difficulty)
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('settings:updated', onUpdated as EventListener)
    }
    return () => {
      mounted = false
      if (typeof window !== 'undefined') {
        window.removeEventListener('settings:updated', onUpdated as EventListener)
      }
    }
  }, [])

  return (
    <div className="text-sm text-[var(--color-muted)]" title="Coach Level">
      Coach · Lv. {level ?? '-'}
    </div>
  )
}

export default LevelBadge

