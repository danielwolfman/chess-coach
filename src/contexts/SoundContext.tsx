import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type SoundContextType = {
  soundsEnabled: boolean
  setSoundsEnabled: (enabled: boolean) => void
  playSound: (audioPath: string) => void
  playSoundForce: (audioPath: string) => void
}

const SoundContext = createContext<SoundContextType | null>(null)

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    const saved = localStorage.getItem('chess-coach-sounds-enabled')
    return saved !== null ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('chess-coach-sounds-enabled', JSON.stringify(soundsEnabled))
  }, [soundsEnabled])

  const playSound = (audioPath: string) => {
    if (!soundsEnabled) return
    
    try {
      const audio = new Audio(audioPath)
      audio.volume = 0.3
      audio.play().catch(() => {
        // Silently fail if audio can't play
      })
    } catch {
      // Silently fail if audio creation fails
    }
  }

  const playSoundForce = (audioPath: string) => {
    try {
      const audio = new Audio(audioPath)
      audio.volume = 0.3
      audio.play().catch(() => {
        // Silently fail if audio can't play
      })
    } catch {
      // Silently fail if audio creation fails
    }
  }

  return (
    <SoundContext.Provider value={{ soundsEnabled, setSoundsEnabled, playSound, playSoundForce }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSound() {
  const context = useContext(SoundContext)
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider')
  }
  return context
}