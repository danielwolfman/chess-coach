import { useSound } from '@/contexts/SoundContext'

export function SoundToggle() {
  const { soundsEnabled, setSoundsEnabled, playSoundForce } = useSound()

  const handleToggle = () => {
    // Only play sound when turning sounds ON (off → on)
    if (!soundsEnabled) {
      playSoundForce('/assets/sounds/click.wav')
    }
    setSoundsEnabled(!soundsEnabled)
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border hover:bg-[var(--color-surface)] transition-colors"
      style={{ 
        borderColor: 'var(--color-border)',
        background: soundsEnabled ? 'var(--color-surface)' : 'transparent'
      }}
      title={`Sounds ${soundsEnabled ? 'on' : 'off'}`}
    >
      <span className="text-lg">
        {soundsEnabled ? '🔊' : '🔇'}
      </span>
      <span>
        Sounds {soundsEnabled ? 'on' : 'off'}
      </span>
    </button>
  )
}