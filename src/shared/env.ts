type PublicEnv = {
  VITE_APP_NAME: string
}

const getPublicEnv = (): PublicEnv => ({
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME ?? 'Chess Coach',
})

export const env = /* freeze to avoid accidental mutation */ Object.freeze(
  getPublicEnv(),
)

