import { gameDAO } from '@/db/indexeddb';
import type { GameState, GameMove } from '@/rules/chess';
import type { PlyAnnotation } from '@/types/annotations';

export interface AutoSaveSnapshot {
  gameId: string;
  fen: string;
  pgn: string;
  lastMove?: GameMove;
  evaluations?: Record<string, number>;
  annotations?: Record<string, PlyAnnotation>;
  timestamp: number;
}

export interface AutoSaveOptions {
  debounceMs?: number;
  maxRetries?: number;
  onSave?: (snapshot: AutoSaveSnapshot) => void;
  onError?: (error: Error) => void;
}

class AutoSaveService {
  private debounceTimeout: number | null = null;
  private pendingSnapshot: AutoSaveSnapshot | null = null;
  private options: Required<AutoSaveOptions>;
  private isEnabled = true;

  constructor(options: AutoSaveOptions = {}) {
    this.options = {
      debounceMs: 400,
      maxRetries: 3,
      onSave: () => {},
      onError: () => {},
      ...options,
    };
  }

  saveAfterMove(gameId: string, gameState: GameState, evaluations?: Record<string, number>, annotations?: Record<string, PlyAnnotation>): void {
    if (!this.isEnabled) return;

    const lastMove = gameState.history[gameState.history.length - 1];
    const snapshot: AutoSaveSnapshot = {
      gameId,
      fen: gameState.fen,
      pgn: gameState.pgn,
      lastMove,
      evaluations,
      annotations,
      timestamp: Date.now(),
    };

    this.pendingSnapshot = snapshot;

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      if (this.pendingSnapshot) {
        this.performSave(this.pendingSnapshot);
        this.pendingSnapshot = null;
      }
      this.debounceTimeout = null;
    }, this.options.debounceMs);
  }

  private async performSave(snapshot: AutoSaveSnapshot, retryCount = 0): Promise<void> {
    try {
      const existingGame = await gameDAO.getById(snapshot.gameId);
      
      if (existingGame) {
        const meta: Record<string, any> = {
          ...existingGame.metadata,
          lastMove: snapshot.lastMove,
          evaluations: snapshot.evaluations,
          autoSavedAt: snapshot.timestamp,
        }
        if (snapshot.annotations) {
          meta.annotations = snapshot.annotations
        }

        await gameDAO.update(snapshot.gameId, {
          fen: snapshot.fen,
          pgn: snapshot.pgn,
          metadata: meta,
        });
      } else {
        const meta: Record<string, any> = {
          lastMove: snapshot.lastMove,
          evaluations: snapshot.evaluations,
          autoSavedAt: snapshot.timestamp,
        }
        if (snapshot.annotations) {
          meta.annotations = snapshot.annotations
        }

        await gameDAO.create({
          id: snapshot.gameId,
          name: `Auto-saved Game ${new Date(snapshot.timestamp).toLocaleString()}`,
          fen: snapshot.fen,
          pgn: snapshot.pgn,
          metadata: meta,
        });
      }

      this.options.onSave(snapshot);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown save error');
      
      if (retryCount < this.options.maxRetries) {
        setTimeout(() => {
          this.performSave(snapshot, retryCount + 1);
        }, Math.pow(2, retryCount) * 1000);
      } else {
        this.options.onError(err);
      }
    }
  }

  flushPending(): Promise<void> {
    return new Promise((resolve) => {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = null;
      }

      if (this.pendingSnapshot) {
        this.performSave(this.pendingSnapshot).finally(() => {
          this.pendingSnapshot = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    this.pendingSnapshot = null;
  }

  isActive(): boolean {
    return this.isEnabled && (this.debounceTimeout !== null || this.pendingSnapshot !== null);
  }

  updateOptions(options: Partial<AutoSaveOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

export const autoSaveService = new AutoSaveService();

export default AutoSaveService;
