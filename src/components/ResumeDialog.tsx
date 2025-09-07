import type { Game } from '@/db/indexeddb'

interface ResumeDialogProps {
  isOpen: boolean
  game: Game | null
  onResume: () => void
  onNewGame: () => void
  onClose: () => void
}

export function ResumeDialog({ isOpen, game, onResume, onNewGame, onClose }: ResumeDialogProps) {
  if (!isOpen || !game) return null

  const lastMoveText = game.metadata?.lastMove 
    ? `${game.metadata.lastMove.san}`
    : 'No moves yet'

  const timeAgo = new Date(game.updatedAt).toLocaleString()

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        style={{ 
          background: 'var(--color-surface)', 
          borderRadius: 'var(--radius-l)',
          border: '1px solid var(--color-border)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-fg)' }}>
            Resume Game?
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            style={{ color: 'var(--color-muted)' }}
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <div className="ui-card mb-4">
            <h3 className="font-medium mb-2">{game.name}</h3>
            <div className="text-sm space-y-1" style={{ color: 'var(--color-muted)' }}>
              <div>Last move: <span className="font-mono">{lastMoveText}</span></div>
              <div>Last saved: {timeAgo}</div>
              {game.metadata?.evaluations && Object.keys(game.metadata.evaluations).length > 0 && (
                <div>Analyzed positions: {Object.keys(game.metadata.evaluations).length}</div>
              )}
            </div>
          </div>
          
          <p style={{ color: 'var(--color-muted)' }} className="text-sm">
            You have an unfinished game. Would you like to resume where you left off or start a new game?
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onResume}
            className="flex-1 px-4 py-2 rounded font-medium transition-colors"
            style={{ 
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
              borderRadius: 'var(--radius-m)'
            }}
          >
            Resume Game
          </button>
          <button
            onClick={onNewGame}
            className="flex-1 px-4 py-2 rounded font-medium border transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
            style={{ 
              borderColor: 'var(--color-border)',
              color: 'var(--color-fg)',
              borderRadius: 'var(--radius-m)'
            }}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  )
}
