import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { ChessGame, type GameState, type Move, type GameMove } from '@/rules/chess';
import { autoSaveService } from '@/services/autosave';
import { resumeService } from '@/services/resume';
import { generateId } from '@/shared/utils';
import { useSound } from '@/contexts/SoundContext';
import type { Game } from '@/db/indexeddb';
import { perPlyEvaluation } from '@/services/evaluation';
import { classifyMistake, type MistakeLabel } from '@/services/mistake';
import type { PlyAnnotation } from '@/types/annotations';

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
  const { playMoveSound, playCaptureSound, playCheckSound } = useSound();
  const evaluationsRef = useRef<Record<string, number>>({});
  const annotationsRef = useRef<Record<string, PlyAnnotation>>({});

  const updateGameState = useCallback((chessGame: ChessGame) => {
    const newState = chessGame.getState();
    setGameState(newState);
    return newState;
  }, []);

  const makeMove = useCallback((move: string | Move): GameMove | null => {
    if (!game || !gameId) return null;

    // Capture state before making the move
    const beforeFen = game.fen();
    const moveResult = game.move(move);
    if (moveResult) {
      const newState = updateGameState(game);
      // Compute quick per-ply evaluation + classification and persist
      try {
        const evalRes = perPlyEvaluation(beforeFen, newState.fen, moveResult.color);
        const ply = String(newState.history.length);
        evaluationsRef.current[ply] = evalRes.evalAfter;

        const san = moveResult.san;
        const uci = `${moveResult.from}${moveResult.to}${moveResult.promotion ?? ''}`;
        const classification = classifyMistake({
          evalBefore: evalRes.evalBefore,
          evalAfter: evalRes.evalAfter,
        });
        const annotation: PlyAnnotation = {
          ply: Number(ply),
          san,
          uci,
          fen: newState.fen,
          evalBefore: evalRes.evalBefore,
          evalAfter: evalRes.evalAfter,
          delta: evalRes.delta,
          classification: classification.label as MistakeLabel,
          notes: classification.notes,
          timestamp: Date.now(),
        };
        annotationsRef.current[ply] = annotation;

        autoSaveService.saveAfterMove(
          gameId,
          newState,
          { ...evaluationsRef.current },
          { ...annotationsRef.current }
        );
      } catch (e) {
        // Fallback to saving without annotations/evals on any unexpected error
        autoSaveService.saveAfterMove(gameId, newState);
      }
      
      // Play appropriate sound based on the move
      if (newState.inCheck) {
        playCheckSound();
      } else if (moveResult.captured) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
    }
    return moveResult;
  }, [game, gameId, updateGameState, playMoveSound, playCaptureSound, playCheckSound]);

  const undoMove = useCallback((): GameMove | null => {
    if (!game || !gameId) return null;

    const undoResult = game.undo();
    if (undoResult) {
      const newState = updateGameState(game);
      // Remove the last stored evaluation/annotation if exists and persist
      const ply = String(newState.history.length + 1);
      if (evaluationsRef.current[ply] != null) {
        delete evaluationsRef.current[ply];
      }
      if (annotationsRef.current[ply] != null) {
        delete annotationsRef.current[ply];
      }
      autoSaveService.saveAfterMove(gameId, newState, { ...evaluationsRef.current }, { ...annotationsRef.current });
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
