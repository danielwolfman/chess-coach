import { gameDAO } from '@/db/indexeddb'
import type { Game } from '@/db/indexeddb'
import { ChessGame } from '@/rules/chess'

export interface UnfinishedGame {
  game: Game
  isUnfinished: boolean
  moveCount: number
  lastPlayedAt: number
}

class ResumeService {
  async detectUnfinishedGame(): Promise<UnfinishedGame | null> {
    try {
      const games = await gameDAO.getAllByCreated()
      if (games.length === 0) return null

      const recentGames = games
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10)

      for (const game of recentGames) {
        const unfinishedStatus = this.checkIfGameUnfinished(game)
        if (unfinishedStatus.isUnfinished) {
          return unfinishedStatus
        }
      }

      return null
    } catch (error) {
      console.error('Error detecting unfinished game:', error)
      return null
    }
  }

  private checkIfGameUnfinished(game: Game): UnfinishedGame {
    try {
      const chessGame = new ChessGame()
      
      let isValidLoad = false
      let moveCount = 0

      if (game.pgn) {
        isValidLoad = chessGame.loadPgn(game.pgn)
        moveCount = chessGame.history().length
      } else if (game.fen) {
        isValidLoad = chessGame.load(game.fen)
        moveCount = 0
      }

      if (!isValidLoad) {
        return {
          game,
          isUnfinished: false,
          moveCount: 0,
          lastPlayedAt: game.updatedAt
        }
      }

      const gameState = chessGame.getState()
      
      const isUnfinished = !gameState.gameOver && (
        moveCount > 0 || 
        gameState.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      )

      const timeSinceLastMove = Date.now() - game.updatedAt
      const wasRecentlyPlayed = timeSinceLastMove < 24 * 60 * 60 * 1000

      return {
        game,
        isUnfinished: isUnfinished && wasRecentlyPlayed,
        moveCount,
        lastPlayedAt: game.updatedAt
      }
    } catch (error) {
      console.error('Error checking game status:', error)
      return {
        game,
        isUnfinished: false,
        moveCount: 0,
        lastPlayedAt: game.updatedAt
      }
    }
  }

  async getMostRecentUnfinishedGame(): Promise<Game | null> {
    const unfinishedGame = await this.detectUnfinishedGame()
    return unfinishedGame?.game || null
  }

  async hasUnfinishedGames(): Promise<boolean> {
    const unfinishedGame = await this.detectUnfinishedGame()
    return unfinishedGame?.isUnfinished || false
  }
}

export const resumeService = new ResumeService()
export default ResumeService