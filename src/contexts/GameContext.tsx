import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ChessGame, type GameState, type Move, type GameMove } from '@/rules/chess';
import { autoSaveService } from '@/services/autosave';
import { resumeService } from '@/services/resume';
import { generateId } from '@/shared/utils';
import type { Game } from '@/db/indexeddb';

interface GameContextType {
  game: ChessGame | null;
  gameState: GameState | null;
  gameId: string | null;
  isLoading: boolean;
  makeMove: (move: string | Move) => GameMove | null;
  undoMove: () => GameMove | null;
  resetGame: () => void;
  loadGame: (fen?: string, pgn?: string) => void;
  newGame: () => void;
  resumeGame: (savedGame: Game) => void;
  checkForUnfinishedGame: () => Promise<Game | null>;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<ChessGame | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateGameState = useCallback((chessGame: ChessGame) => {
    const newState = chessGame.getState();
    setGameState(newState);
    return newState;
  }, []);

  const makeMove = useCallback((move: string | Move): GameMove | null => {
    if (!game || !gameId) return null;

    const moveResult = game.move(move);
    if (moveResult) {
      const newState = updateGameState(game);
      autoSaveService.saveAfterMove(gameId, newState);
    }
    return moveResult;
  }, [game, gameId, updateGameState]);

  const undoMove = useCallback((): GameMove | null => {
    if (!game || !gameId) return null;

    const undoResult = game.undo();
    if (undoResult) {
      const newState = updateGameState(game);
      autoSaveService.saveAfterMove(gameId, newState);
    }
    return undoResult;
  }, [game, gameId, updateGameState]);

  const resetGame = useCallback(() => {
    if (!game) return;

    game.reset();
    updateGameState(game);
    const newGameId = generateId();
    setGameId(newGameId);
  }, [game, updateGameState]);

  const loadGame = useCallback((fen?: string, pgn?: string) => {
    setIsLoading(true);
    try {
      let chessGame: ChessGame;
      
      if (pgn) {
        chessGame = ChessGame.fromPgn(pgn);
      } else if (fen) {
        chessGame = ChessGame.fromFen(fen);
      } else {
        chessGame = new ChessGame();
      }

      setGame(chessGame);
      updateGameState(chessGame);
      setGameId(generateId());
    } catch (error) {
      console.error('Failed to load game:', error);
      const fallbackGame = new ChessGame();
      setGame(fallbackGame);
      updateGameState(fallbackGame);
      setGameId(generateId());
    } finally {
      setIsLoading(false);
    }
  }, [updateGameState]);

  const newGame = useCallback(() => {
    const chessGame = new ChessGame();
    setGame(chessGame);
    updateGameState(chessGame);
    setGameId(generateId());
  }, [updateGameState]);

  const resumeGame = useCallback((savedGame: Game) => {
    setIsLoading(true);
    try {
      let chessGame: ChessGame;
      
      if (savedGame.pgn) {
        chessGame = ChessGame.fromPgn(savedGame.pgn);
      } else if (savedGame.fen) {
        chessGame = ChessGame.fromFen(savedGame.fen);
      } else {
        chessGame = new ChessGame();
      }

      setGame(chessGame);
      updateGameState(chessGame);
      setGameId(savedGame.id);
    } catch (error) {
      console.error('Failed to resume game:', error);
      const fallbackGame = new ChessGame();
      setGame(fallbackGame);
      updateGameState(fallbackGame);
      setGameId(generateId());
    } finally {
      setIsLoading(false);
    }
  }, [updateGameState]);

  const checkForUnfinishedGame = useCallback(async (): Promise<Game | null> => {
    try {
      const unfinishedGame = await resumeService.getMostRecentUnfinishedGame();
      return unfinishedGame;
    } catch (error) {
      console.error('Error checking for unfinished games:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const chessGame = new ChessGame();
    setGame(chessGame);
    updateGameState(chessGame);
    setGameId(generateId());

    return () => {
      autoSaveService.flushPending();
    };
  }, [updateGameState]);

  const contextValue: GameContextType = {
    game,
    gameState,
    gameId,
    isLoading,
    makeMove,
    undoMove,
    resetGame,
    loadGame,
    newGame,
    resumeGame,
    checkForUnfinishedGame,
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}