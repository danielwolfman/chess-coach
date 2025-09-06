import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'

import AppLayout from '@/components/AppLayout'
import { Skeleton } from '@/components/Skeleton'
import { SoundToggle } from '@/components/SoundToggle'
import { LevelBadge } from '@/components/LevelBadge'
import { ResumeDialog } from '@/components/ResumeDialog'
import { Board } from '@/components/Board'
import { CoachPanel } from '@/components/CoachPanel'
import { TTSSettings } from '@/components/TTSSettings'
import { ttsAdapter } from '@/services/tts-adapter'
import { APISetupWizard } from '@/components/APISetupWizard'
import { AIStatusIndicator } from '@/components/AIStatusIndicator'
import { WelcomeOverlay } from '@/components/WelcomeOverlay'
import { SetupWizardService } from '@/services/setup-wizard'
import { useGame } from '@/contexts/GameContext'
import type { Square } from '@/rules/chess'
import { env } from '@/shared/env'
import { exportGameToPgn, generateGameFilename } from '@/utils/pgn'
import type { Game } from '@/db/indexeddb'
import ChessGame from '@/rules/chess'
import { perPlyEvaluation } from '@/services/evaluation'
import { MicroAdjustController } from '@/services/micro-adjust'
import { settingsDAO } from '@/db/indexeddb'
import { mapLevelToEngineOptions } from '@/engine/difficulty'
import { getStockfishEngine, selectMoveTopK } from '@/engine'
import { ResignationController, assessResignation } from '@/services/resignation'
import { computeGPS, type GameStatsForGPS, type Result } from '@/services/gps'
import { applyLevelUpdateFromGPS } from '@/services/level'

export default function App() {
  const { resumeGame, newGame, checkForUnfinishedGame, gameState, gameId, makeMove, getAnnotations, mistakeAvailable, coachState, requestMistakeExplanation, clearMistakeAvailable } = useGame()
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [unfinishedGame, setUnfinishedGame] = useState<Game | null>(null)
  const [boardSize, setBoardSize] = useState(500)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | undefined>(undefined)
  const microAdjustRef = useRef<MicroAdjustController>(new MicroAdjustController())
  const [baseLevel, setBaseLevel] = useState<number>(3)
  const coachThinkingRef = useRef(false)
  const [coachRationale, setCoachRationale] = useState<string>('')
  const resignCtrlRef = useRef<ResignationController>(new ResignationController())
  const [resignedInfo, setResignedInfo] = useState<{ reason: string } | null>(null)
  const [showTTSSettings, setShowTTSSettings] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isTTSEnabled, setIsTTSEnabled] = useState(true)

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

  // Load TTS enabled state on mount
  useEffect(() => {
    const loadTTSSettings = () => {
      try {
        const saved = localStorage.getItem('chess-coach-tts-settings');
        if (saved) {
          const settings = JSON.parse(saved);
          setIsTTSEnabled(settings.enabled ?? true);
        }
      } catch (e) {
        console.warn('Failed to load TTS settings:', e);
      }
    }
    loadTTSSettings()
  }, [])

  // Check if welcome overlay or setup wizard should be shown
  useEffect(() => {
    const checkFirstTimeUser = async () => {
      // Wait a bit for the app to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (SetupWizardService.shouldShowWelcome()) {
        setShowWelcome(true);
      } else if (SetupWizardService.shouldShowWizard()) {
        // Wait a bit longer before showing wizard if welcome wasn't shown
        await new Promise(resolve => setTimeout(resolve, 1000));
        setShowSetupWizard(true);
      }
    };

    checkFirstTimeUser();
  }, [])

  // Load base difficulty and listen for updates
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const s = await settingsDAO.getDefault() ?? await settingsDAO.upsertDefault({})
        if (mounted) setBaseLevel(s.difficulty)
      } catch (e) {
        // ignore
      }
    }
    load()
    const onSettings = (e: any) => {
      if (e?.detail?.difficulty != null) setBaseLevel(e.detail.difficulty)
    }
    try {
      window.addEventListener('settings:updated' as any, onSettings as any)
    } catch {}
    return () => {
      mounted = false
      try { window.removeEventListener('settings:updated' as any, onSettings as any) } catch {}
    }
  }, [])

  useEffect(() => {
    const updateBoardSize = () => {
      const maxSize = Math.min(600, window.innerWidth - 100, window.innerHeight - 200)
      setBoardSize(Math.max(300, maxSize))
    }

    updateBoardSize()
    window.addEventListener('resize', updateBoardSize)
    return () => window.removeEventListener('resize', updateBoardSize)
  }, [])

  // Handle game end and level adjustment
  useEffect(() => {
    if (!gameState || !gameState.gameOver) return

    const processGameEnd = async () => {
      try {
        // Determine the result from white's perspective
        let result: Result = 0 // draw
        
        if (gameState.inCheckmate) {
          // If it's white's turn and checkmate, white loses (black wins)
          // If it's black's turn and checkmate, black loses (white wins)
          result = gameState.turn === 'w' ? -1 : 1
        }
        // Resignation handling
        else if (resignedInfo) {
          // Coach resigned, so player (white) wins
          result = 1
        }

        // Calculate player move count (white's moves only)
        const playerMoveCount = Math.ceil(gameState.history.length / 2)
        
        // Count blunders from stored annotations (player moves only - odd ply numbers)
        const annotations = getAnnotations()
        let blunders = 0
        let totalPlayerLoss = 0
        let playerMoveEvaluated = 0
        
        Object.values(annotations).forEach(annotation => {
          // Player moves are odd ply numbers (1, 3, 5, etc.)
          if (annotation.ply % 2 === 1) {
            if (annotation.classification === 'blunder') {
              blunders++
            }
            if (annotation.delta != null && annotation.delta > 0) {
              totalPlayerLoss += annotation.delta
              playerMoveEvaluated++
            }
          }
        })
        
        const avgLossCp = playerMoveEvaluated > 0 ? (totalPlayerLoss / playerMoveEvaluated) : null
        
        const gpsData: GameStatsForGPS = {
          result,
          playerMoveCount,
          blunders,
          avgLossCp
        }

        const gps = computeGPS(gpsData)
        const levelUpdate = await applyLevelUpdateFromGPS(gps)
        
        console.log('Game ended - GPS:', gps.toFixed(3), 'Level change:', levelUpdate.oldLevel, '->', levelUpdate.newLevel)
        
        // Update the displayed level if it changed
        if (levelUpdate.newLevel !== levelUpdate.oldLevel) {
          setBaseLevel(levelUpdate.newLevel)
        }
      } catch (error) {
        console.error('Failed to process game end for level adjustment:', error)
      }
    }

    processGameEnd()
  }, [gameState?.gameOver, gameState?.inCheckmate, gameState?.turn, gameState?.history, resignedInfo])

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
    microAdjustRef.current.reset()
    setCoachRationale('')
    resignCtrlRef.current.reset()
    setResignedInfo(null)
  }

  const handleCloseDialog = () => {
    setShowResumeDialog(false)
  }

  const handleMove = async (move: { from: string; to: string; promotion?: string }) => {
    const beforeFen = gameState?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const moveData = {
      from: move.from as Square,
      to: move.to as Square,
      promotion: move.promotion as any
    }
    const moveResult = makeMove(moveData)
    if (moveResult) {
      console.log('Move made:', moveResult)
      // Update micro-adjust from player's perspective using a temp game to get after-FEN immediately
      try {
        const tmp = ChessGame.fromFen(beforeFen)
        const applied = tmp.move(moveData)
        if (applied) {
          const evalRes = perPlyEvaluation(beforeFen, tmp.fen(), applied.color)
          microAdjustRef.current.update(evalRes.evalAfter)
          // If game is already over after player's move, skip coach response
          if (!tmp.isGameOver()) {
            // Let coach respond after a short tick so UI updates
            setTimeout(() => {
              coachRespond(tmp.fen()).catch(err => console.error('Coach move error:', err))
            }, 50)
          }
        }
      } catch (e) {
        console.warn('Micro-adjust update failed:', e)
      }
    } else {
      console.log('Invalid move:', move)
    }
  }

  // Auto-derive lastMove from history to animate both player and coach moves
  useEffect(() => {
    const h = gameState?.history
    if (h && h.length > 0) {
      const last = h[h.length - 1]
      if (last?.from && last?.to) setLastMove({ from: last.from, to: last.to })
    }
  }, [gameState?.history])

  // Coach selects and plays a move based on engine mapping and micro-adjust
  const coachRespond = useMemo(() => {
    return async (fenAfterPlayer: string) => {
      if (coachThinkingRef.current) return
      if (resignedInfo) return
      coachThinkingRef.current = true
      try {
        const effectiveLevel = microAdjustRef.current.effectiveLevel(baseLevel)
        const opts = mapLevelToEngineOptions(effectiveLevel)
        const engine = getStockfishEngine()
        await engine.initialize()
        // Set tunables that persist across searches
        try {
          engine.sendCommand(`setoption name Skill Level value ${Math.max(1, Math.min(20, Math.round(opts.skill)))}`)
          engine.sendCommand(`setoption name Contempt value ${Math.round(opts.contempt)}`)
        } catch {}
        // Search with MultiPV to allow top-K sampling
        const result = await engine.search(fenAfterPlayer, { depth: opts.depth, multipv: Math.max(1, opts.randomness.topK) })

        // Resignation checks before selecting/playing a move
        try {
          const { immediateMatePly, hasDrawishResource } = await assessResignation(fenAfterPlayer, result)
          if (immediateMatePly != null) {
            setResignedInfo({ reason: "Coach resigns: forced mate in " + immediateMatePly + "." })
            return
          }
          const badStreak = resignCtrlRef.current.update(result.score_cp)
          if (badStreak && !hasDrawishResource) {
            setResignedInfo({ reason: 'Coach resigns: evaluation = -9.0 over last 3 plies.' })
            return
          }
        } catch (e) {
          // On any resignation assessment error, do not resign
        }
        let uci = result.bestmove
        if (result.pvs && result.pvs.length > 0) {
          const roll = Math.random()
          if (opts.randomness.topK > 1 && roll < opts.blunderChance) {
            const worst = [...result.pvs].sort((a, b) => (a.mate != null || b.mate != null) ? ((a.mate ?? -99999) - (b.mate ?? -99999)) : ((a.score_cp ?? -99999) - (b.score_cp ?? -99999)))[0]
            uci = worst.bestmove || worst.pv[0]
          } else {
            const choice = selectMoveTopK(result.pvs, opts.randomness.topK)
            uci = choice.bestmove || choice.pv[0]
          }
        }
        if (!uci) return
        if (env.VITE_DEV_SHOW_RATIONALE) {
          setCoachRationale(`Coach prefers ${uci} at Lv.${effectiveLevel}.`)
        }
        const from = uci.slice(0, 2)
        const to = uci.slice(2, 4)
        const promo = uci.length > 4 ? uci.slice(4, 5) : undefined
        makeMove({ from: from as Square, to: to as Square, promotion: promo as any })
      } finally {
        coachThinkingRef.current = false
      }
    }
  }, [baseLevel, makeMove, resignedInfo])

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

  const handleTTSToggle = () => {
    const newEnabled = !isTTSEnabled
    setIsTTSEnabled(newEnabled)
    ttsAdapter.setEnabled(newEnabled)
  }
  const Topbar = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <div className="text-2xl">♔</div>
        <div className="font-semibold tracking-tight">{env.VITE_APP_NAME}</div>
      </div>
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="hover:underline">Home</Link>
        </nav>
        <AIStatusIndicator />
        <LevelBadge />
        <SoundToggle />
        <button
          onClick={handleTTSToggle}
          className={`ui-btn text-sm ${
            isTTSEnabled 
              ? 'ui-btn--success' 
              : 'ui-btn--ghost'
          }`}
          title={`Text-to-Speech is ${isTTSEnabled ? 'enabled' : 'disabled'} - Click to toggle`}
        >
          {isTTSEnabled ? '🔊' : '🔇'} TTS
        </button>
        <button
          onClick={() => setShowTTSSettings(true)}
          className="ui-btn ui-btn--ghost text-sm"
          title="Text-to-Speech Settings"
        >
          ⚙️
        </button>
        <button
          onClick={() => setShowSetupWizard(true)}
          className="ui-btn ui-btn--accent text-sm"
          title="AI Setup Wizard"
        >
          🤖 AI Setup
        </button>
      </div>
    </div>
  )

  const RightPanel = (
    <div className="space-y-4">
      <CoachPanel 
        coachState={coachState}
        mistakeAvailable={mistakeAvailable}
        onRequestMistakeExplanation={requestMistakeExplanation}
        onClearMistakeAvailable={clearMistakeAvailable}
        resignedInfo={resignedInfo}
        devRationale={coachRationale}
        showDevRationale={env.VITE_DEV_SHOW_RATIONALE}
      />
      <div className="ui-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-medium">Moves</h3>
          <button
            onClick={handleExportPgn}
            className="ui-btn ui-btn--ghost text-xs"
            disabled={!gameState?.pgn || gameState.pgn.trim() === '' || gameState.pgn.trim() === '1. '}
          >
            Export PGN
          </button>
        </div>
        <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
          {gameState?.history && gameState.history.length > 0 ? (
            gameState.history.map((move, index) => (
              <div key={index} className="flex text-xs">
                <span className="w-8 text-[var(--color-muted)]">
                  {Math.ceil((index + 1) / 2)}.
                </span>
                <span className="font-mono">
                  {index % 2 === 0 && <span className="mr-2">{move.san}</span>}
                  {index % 2 === 1 && <span className="text-[var(--color-muted)]">{move.san}</span>}
                </span>
              </div>
            ))
          ) : (
            <div className="text-[var(--color-muted)] text-xs">No moves yet</div>
          )}
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
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent mb-2">
              ♔ Chess Coach ♕
            </h1>
            <p className="text-[var(--color-muted)] text-lg font-medium">Master your chess skills with AI-powered coaching</p>
            <div className="mt-2 h-1 w-32 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-4 mb-4 border border-blue-200/30 dark:border-blue-800/30">
            <p className="text-[var(--color-muted)] text-center">🖱️ Use drag & drop or click to move pieces • 🎯 Both interaction methods are supported!</p>
          </div>
          <div className="ui-card">
            <div className="flex justify-center">
              <Board 
                position={gameState?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                highlights={[]}
                lastMove={lastMove}
                draggable={!resignedInfo}
                clickable={!resignedInfo}
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
                {resignedInfo && (
                  <div className="text-yellow-600 font-medium">{resignedInfo.reason}</div>
                )}
                {!gameState.gameOver && !resignedInfo && (
                  <div className="text-[var(--color-muted)]">
                    {gameState.turn === 'w' ? 'White' : 'Black'} to move
                  </div>
                )}
                {(gameState.gameOver || resignedInfo) && (
                  <div className="mt-3">
                    <button
                      onClick={handleNewGame}
                      className="ui-btn ui-btn--success text-sm"
                    >
                      🎮 New Game
                    </button>
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

      <TTSSettings
        isOpen={showTTSSettings}
        onClose={() => setShowTTSSettings(false)}
      />

      <WelcomeOverlay
        isOpen={showWelcome}
        onClose={() => {
          setShowWelcome(false);
          SetupWizardService.markWelcomeSeen();
        }}
        onSetupAI={() => {
          setShowWelcome(false);
          SetupWizardService.markWelcomeSeen();
          setShowSetupWizard(true);
        }}
      />

      <APISetupWizard
        isOpen={showSetupWizard}
        onClose={() => {
          setShowSetupWizard(false);
          SetupWizardService.markWizardDismissed();
        }}
        onComplete={() => {
          setShowSetupWizard(false);
          SetupWizardService.markSetupCompleted();
          console.log('AI Coach setup completed!');
        }}
      />
    </>
  )
}


