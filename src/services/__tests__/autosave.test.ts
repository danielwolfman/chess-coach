import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import AutoSaveService, { autoSaveService } from '../autosave';
import { gameDAO } from '@/db/indexeddb';
import { ChessGame } from '@/rules/chess';

vi.mock('@/db/indexeddb', () => ({
  gameDAO: {
    getById: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

describe('AutoSaveService', () => {
  let service: AutoSaveService;
  let mockGameDAO: {
    getById: Mock;
    update: Mock;
    create: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGameDAO = gameDAO as any;
    service = new AutoSaveService({ debounceMs: 100 });
  });

  afterEach(() => {
    service.disable();
    vi.clearAllTimers();
  });

  it('should create a new instance with default options', () => {
    const defaultService = new AutoSaveService();
    expect(defaultService.isActive()).toBe(false);
  });

  it('should debounce save calls', async () => {
    const game = new ChessGame();
    game.move('e4');
    const gameState = game.getState();
    const gameId = 'test-game-1';

    mockGameDAO.getById.mockResolvedValue(null);
    mockGameDAO.create.mockResolvedValue({});

    service.saveAfterMove(gameId, gameState);
    service.saveAfterMove(gameId, gameState);
    service.saveAfterMove(gameId, gameState);

    expect(mockGameDAO.create).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(mockGameDAO.create).toHaveBeenCalledTimes(1);
    expect(mockGameDAO.create).toHaveBeenCalledWith({
      id: gameId,
      name: expect.stringContaining('Auto-saved Game'),
      fen: gameState.fen,
      pgn: gameState.pgn,
      metadata: {
        lastMove: gameState.history[gameState.history.length - 1],
        evaluations: undefined,
        autoSavedAt: expect.any(Number),
      },
    });
  });

  it('should update existing game when it exists', async () => {
    const game = new ChessGame();
    game.move('e4');
    const gameState = game.getState();
    const gameId = 'existing-game';

    const existingGame = {
      id: gameId,
      name: 'Existing Game',
      fen: 'old-fen',
      pgn: 'old-pgn',
      metadata: { oldData: true },
    };

    mockGameDAO.getById.mockResolvedValue(existingGame);
    mockGameDAO.update.mockResolvedValue({});

    service.saveAfterMove(gameId, gameState, { 'e4': 0.5 });

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(mockGameDAO.update).toHaveBeenCalledTimes(1);
    expect(mockGameDAO.update).toHaveBeenCalledWith(gameId, {
      fen: gameState.fen,
      pgn: gameState.pgn,
      metadata: {
        oldData: true,
        lastMove: gameState.history[gameState.history.length - 1],
        evaluations: { 'e4': 0.5 },
        autoSavedAt: expect.any(Number),
      },
    });
  });

  it('should handle save errors with retries', async () => {
    vi.useFakeTimers();
    
    const game = new ChessGame();
    game.move('e4');
    const gameState = game.getState();
    const gameId = 'error-game';

    const onError = vi.fn();
    const errorService = new AutoSaveService({
      debounceMs: 50,
      maxRetries: 2,
      onError,
    });

    mockGameDAO.getById.mockResolvedValue(null);
    mockGameDAO.create.mockRejectedValue(new Error('DB Error'));

    errorService.saveAfterMove(gameId, gameState);

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    expect(mockGameDAO.create).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledWith(new Error('DB Error'));

    errorService.disable();
    vi.useRealTimers();
  }, 10000);

  it('should call onSave callback on successful save', async () => {
    const game = new ChessGame();
    game.move('e4');
    const gameState = game.getState();
    const gameId = 'callback-game';

    const onSave = vi.fn();
    const callbackService = new AutoSaveService({
      debounceMs: 50,
      onSave,
    });

    mockGameDAO.getById.mockResolvedValue(null);
    mockGameDAO.create.mockResolvedValue({});

    callbackService.saveAfterMove(gameId, gameState);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(onSave).toHaveBeenCalledWith({
      gameId,
      fen: gameState.fen,
      pgn: gameState.pgn,
      lastMove: gameState.history[gameState.history.length - 1],
      evaluations: undefined,
      timestamp: expect.any(Number),
    });

    callbackService.disable();
  });

  it('should not save when disabled', async () => {
    const game = new ChessGame();
    game.move('e4');
    const gameState = game.getState();
    const gameId = 'disabled-game';

    service.disable();
    service.saveAfterMove(gameId, gameState);

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(mockGameDAO.create).not.toHaveBeenCalled();
    expect(mockGameDAO.update).not.toHaveBeenCalled();
  });

  it('should flush pending saves immediately', async () => {
    const game = new ChessGame();
    game.move('e4');
    const gameState = game.getState();
    const gameId = 'flush-game';

    mockGameDAO.getById.mockResolvedValue(null);
    mockGameDAO.create.mockResolvedValue({});

    service.saveAfterMove(gameId, gameState);
    
    expect(mockGameDAO.create).not.toHaveBeenCalled();
    
    await service.flushPending();
    
    expect(mockGameDAO.create).toHaveBeenCalledTimes(1);
  });

  it('should track active state correctly', () => {
    expect(service.isActive()).toBe(false);

    const game = new ChessGame();
    game.move('e4');
    const gameState = game.getState();

    service.saveAfterMove('active-game', gameState);
    expect(service.isActive()).toBe(true);

    service.disable();
    expect(service.isActive()).toBe(false);
  });

  it('should update options dynamically', async () => {
    const game = new ChessGame();
    game.move('e4');
    const gameState = game.getState();
    const gameId = 'options-game';

    const onSave = vi.fn();
    service.updateOptions({ onSave });

    mockGameDAO.getById.mockResolvedValue(null);
    mockGameDAO.create.mockResolvedValue({});

    service.saveAfterMove(gameId, gameState);

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(onSave).toHaveBeenCalled();
  });
});

describe('autoSaveService singleton', () => {
  it('should be a properly configured singleton', () => {
    expect(autoSaveService).toBeInstanceOf(AutoSaveService);
    expect(autoSaveService.isActive()).toBe(false);
  });
});