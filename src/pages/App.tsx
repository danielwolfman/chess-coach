import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

import AppLayout from '@/components/AppLayout'
import { Skeleton } from '@/components/Skeleton'
import { SoundToggle } from '@/components/SoundToggle'
import { LevelBadge } from '@/components/LevelBadge'
import { ResumeDialog } from '@/components/ResumeDialog'
import { Board } from '@/components/Board'
import { useGame } from '@/contexts/GameContext'
import type { Square } from '@/rules/chess'
import { env } from '@/shared/env'
import { exportGameToPgn, generateGameFilename } from '@/utils/pgn'
import type { Game } from '@/db/indexeddb'

export default function App() {
  const { resumeGame, newGame, checkForUnfinishedGame, gameState, gameId, makeMove } = useGame()
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [unfinishedGame, setUnfinishedGame] = useState<Game | null>(null)
  const [boardSize, setBoardSize] = useState(500)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | undefined>(undefined)

  useEffect(() => {
    const checkForResume = async () => {
      try {
        const savedGame = await checkForUnfinishedGame()
        if (savedGame) {
          setUnfinishedGame(savedGame)
          setShowResumeDialog(true)
        }
      } catch (error) {
        console.error('Error checking for unfinished games:', error)
      }
    }

    checkForResume()
  }, [checkForUnfinishedGame])

  useEffect(() => {
    const updateBoardSize = () => {
      const maxSize = Math.min(600, window.innerWidth - 100, window.innerHeight - 200)
      setBoardSize(Math.max(300, maxSize))
    }

    updateBoardSize()
    window.addEventListener('resize', updateBoardSize)
    return () => window.removeEventListener('resize', updateBoardSize)
  }, [])

  const handleResume = () => {
    if (unfinishedGame) {
      resumeGame(unfinishedGame)
    }
    setShowResumeDialog(false)
  }

  const handleNewGame = () => {
    newGame()
    setShowResumeDialog(false)
    setLastMove(undefined)
  }

  const handleCloseDialog = () => {
    setShowResumeDialog(false)
  }

  const handleMove = (move: { from: string; to: string; promotion?: string }) => {
    const moveData = {
      from: move.from as Square,
      to: move.to as Square,
      promotion: move.promotion as any
    }
    const moveResult = makeMove(moveData)
    if (moveResult) {
      console.log('Move made:', moveResult)
      setLastMove({ from: move.from, to: move.to })
    } else {
      console.log('Invalid move:', move)
    }
  }

  const handleExportPgn = () => {
    if (gameState?.pgn) {
      const filename = generateGameFilename(gameId || undefined)
      exportGameToPgn(gameState.pgn, {
        filename,
        headers: {
          Date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
          Result: gameState.gameOver 
            ? (gameState.inCheckmate 
                ? (gameState.turn === 'w' ? '0-1' : '1-0')
                : (gameState.inStalemate || gameState.inDraw ? '1/2-1/2' : '*'))
            : '*'
        }
      })
    }
  }
  const Topbar = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-canvas)' }} />
        <div className="font-semibold tracking-tight">{env.VITE_APP_NAME}</div>
      </div>
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="hover:underline">Home</Link>
          <Link to="/health" className="hover:underline">Health</Link>
          <Link to="/db-demo" className="hover:underline">DB Demo</Link>
        </nav>
        <LevelBadge />
        <SoundToggle />
      </div>
    </div>
  )

  const RightPanel = (
    <div className="space-y-4">
      <div className="ui-card">
        <h3 className="text-base font-medium mb-1">Coach</h3>
        <p className="text-sm text-[var(--color-muted)]">Hints, tips, and insights will appear here.</p>
      </div>
      <div className="ui-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-medium">Moves</h3>
          <button
            onClick={handleExportPgn}
            className="text-xs px-2 py-1 rounded border hover:bg-[var(--color-surface)]"
            style={{ borderColor: 'var(--color-border)' }}
            disabled={!gameState?.pgn || gameState.pgn.trim() === '' || gameState.pgn.trim() === '1. '}
          >
            Export PGN
          </button>
        </div>
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
    <>
      <AppLayout topbar={Topbar} right={RightPanel} footer={Footer}>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">Chess Coach</h1>
          <p className="text-[var(--color-muted)]">Use drag & drop or click to move pieces. Both interaction methods are supported!</p>
          <div className="ui-card">
            <div className="flex justify-center">
              <Board 
                position={gameState?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                highlights={[]}
                lastMove={lastMove}
                draggable={true}
                clickable={true}
                size={boardSize}
                theme="default"
                showCoordinates={true}
                onMove={handleMove}
                animationDuration={300}
              />
            </div>
          </div>
          
          {/* Game status */}
          {gameState && (
            <div className="ui-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-medium">Game Status</h3>
                <div className="text-sm text-[var(--color-muted)]">
                  Turn: {gameState.turn === 'w' ? 'White' : 'Black'}
                </div>
              </div>
              <div className="space-y-1 text-sm">
                {gameState.inCheck && (
                  <div className="text-red-600 font-medium">Check!</div>
                )}
                {gameState.inCheckmate && (
                  <div className="text-red-600 font-bold">Checkmate! {gameState.turn === 'w' ? 'Black' : 'White'} wins!</div>
                )}
                {gameState.inStalemate && (
                  <div className="text-yellow-600 font-medium">Stalemate - Draw!</div>
                )}
                {gameState.inDraw && (
                  <div className="text-yellow-600 font-medium">Draw!</div>
                )}
                {!gameState.gameOver && (
                  <div className="text-[var(--color-muted)]">
                    {gameState.turn === 'w' ? 'White' : 'Black'} to move
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AppLayout>

      <ResumeDialog
        isOpen={showResumeDialog}
        game={unfinishedGame}
        onResume={handleResume}
        onNewGame={handleNewGame}
        onClose={handleCloseDialog}
      />
    </>
  )
}
