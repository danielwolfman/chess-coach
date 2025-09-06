type PublicEnv = {
  VITE_APP_NAME: string
  VITE_DEV_SHOW_RATIONALE: boolean
}

const getPublicEnv = (): PublicEnv => ({
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME ?? 'Chess Coach',
  VITE_DEV_SHOW_RATIONALE: normalizeBool(import.meta.env.VITE_DEV_SHOW_RATIONALE),
})

function normalizeBool(v: any): boolean {
  if (v == null) return false
  const s = String(v).toLowerCase().trim()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export const env = /* freeze to avoid accidental mutation */ Object.freeze(
  getPublicEnv(),
)
