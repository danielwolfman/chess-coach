import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gameDAO, settingsDAO, progressDAO, clearAllData, getDatabaseSize } from '../indexeddb';

describe('IndexedDB Adapter', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  describe('GameDAO', () => {
    it('should create and retrieve a game', async () => {
      const gameData = {
        id: 'test-game-1',
        name: 'Test Game',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4 e5',
        result: '1-0'
      };

      const created = await gameDAO.create(gameData);
      expect(created.id).toBe('test-game-1');
      expect(created.name).toBe('Test Game');
      expect(created.createdAt).toBeTypeOf('number');
      expect(created.updatedAt).toBeTypeOf('number');

      const retrieved = await gameDAO.getById('test-game-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Game');
    });

    it('should update a game', async () => {
      const gameData = {
        id: 'test-game-2',
        name: 'Test Game 2',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4'
      };

      await gameDAO.create(gameData);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updated = await gameDAO.update('test-game-2', {
        name: 'Updated Game',
        pgn: '1. e4 e5'
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Game');
      expect(updated?.pgn).toBe('1. e4 e5');
      expect(updated?.updatedAt).toBeGreaterThan(updated?.createdAt || 0);
    });

    it('should delete a game', async () => {
      const gameData = {
        id: 'test-game-3',
        name: 'Test Game 3',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4'
      };

      await gameDAO.create(gameData);
      
      const deleted = await gameDAO.delete('test-game-3');
      expect(deleted).toBe(true);

      const retrieved = await gameDAO.getById('test-game-3');
      expect(retrieved).toBeUndefined();
    });

    it('should get all games', async () => {
      const game1 = {
        id: 'test-game-4',
        name: 'Test Game 4',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4'
      };

      const game2 = {
        id: 'test-game-5',
        name: 'Test Game 5',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. d4'
      };

      await gameDAO.create(game1);
      await gameDAO.create(game2);

      const allGames = await gameDAO.getAll();
      expect(allGames).toHaveLength(2);
      expect(allGames.some(g => g.id === 'test-game-4')).toBe(true);
      expect(allGames.some(g => g.id === 'test-game-5')).toBe(true);
    });

    it('should count games', async () => {
      expect(await gameDAO.count()).toBe(0);

      await gameDAO.create({
        id: 'test-game-6',
        name: 'Test Game 6',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4'
      });

      expect(await gameDAO.count()).toBe(1);
    });
  });

  describe('SettingsDAO', () => {
    it('should create and retrieve settings', async () => {
      const settingsData = {
        id: 'test-settings',
        theme: 'dark' as const,
        soundEnabled: false,
        difficulty: 5,
        boardOrientation: 'black' as const,
        showCoordinates: false,
        analysisDepth: 5
      };

      const created = await settingsDAO.create(settingsData);
      expect(created.theme).toBe('dark');
      expect(created.soundEnabled).toBe(false);

      const retrieved = await settingsDAO.getById('test-settings');
      expect(retrieved).toBeDefined();
      expect(retrieved?.theme).toBe('dark');
    });

    it('should upsert default settings', async () => {
      const defaultSettings = await settingsDAO.upsertDefault({
        theme: 'light',
        soundEnabled: true
      });

      expect(defaultSettings.id).toBe('default');
      expect(defaultSettings.theme).toBe('light');
      expect(defaultSettings.soundEnabled).toBe(true);
      expect(defaultSettings.difficulty).toBe(3); // default value

      const updated = await settingsDAO.upsertDefault({
        theme: 'dark'
      });

      expect(updated.theme).toBe('dark');
      expect(updated.soundEnabled).toBe(true); // preserved
    });

    it('should get default settings', async () => {
      await settingsDAO.upsertDefault({ theme: 'auto' });
      
      const defaultSettings = await settingsDAO.getDefault();
      expect(defaultSettings).toBeDefined();
      expect(defaultSettings?.id).toBe('default');
    });
  });

  describe('ProgressDAO', () => {
    it('should create and retrieve progress', async () => {
      const progressData = {
        id: 'test-progress',
        userId: 'user123',
        gamesPlayed: 10,
        gamesWon: 6,
        gamesLost: 3,
        gamesDrawn: 1,
        totalTime: 3600,
        averageTime: 360,
        bestStreak: 4,
        currentStreak: 2,
        puzzlesSolved: 50,
        puzzleAccuracy: 85.5,
        rating: 1400,
        achievements: ['first_win', 'puzzle_master']
      };

      const created = await progressDAO.create(progressData);
      expect(created.gamesPlayed).toBe(10);
      expect(created.rating).toBe(1400);
      expect(created.achievements).toEqual(['first_win', 'puzzle_master']);

      const retrieved = await progressDAO.getById('test-progress');
      expect(retrieved).toBeDefined();
      expect(retrieved?.rating).toBe(1400);
    });

    it('should upsert default progress', async () => {
      const defaultProgress = await progressDAO.upsertDefault({
        gamesPlayed: 5,
        rating: 1300
      });

      expect(defaultProgress.id).toBe('default');
      expect(defaultProgress.gamesPlayed).toBe(5);
      expect(defaultProgress.rating).toBe(1300);
      expect(defaultProgress.gamesWon).toBe(0); // default value

      const updated = await progressDAO.upsertDefault({
        gamesWon: 3
      });

      expect(updated.gamesWon).toBe(3);
      expect(updated.gamesPlayed).toBe(5); // preserved
    });

    it('should get progress by user', async () => {
      await progressDAO.create({
        id: 'progress1',
        userId: 'user123',
        gamesPlayed: 5,
        gamesWon: 3,
        gamesLost: 2,
        gamesDrawn: 0,
        totalTime: 1800,
        averageTime: 360,
        bestStreak: 2,
        currentStreak: 1,
        puzzlesSolved: 20,
        puzzleAccuracy: 80,
        rating: 1250,
        achievements: []
      });

      await progressDAO.create({
        id: 'progress2',
        userId: 'user456',
        gamesPlayed: 8,
        gamesWon: 4,
        gamesLost: 4,
        gamesDrawn: 0,
        totalTime: 2400,
        averageTime: 300,
        bestStreak: 3,
        currentStreak: 0,
        puzzlesSolved: 30,
        puzzleAccuracy: 75,
        rating: 1180,
        achievements: []
      });

      const user123Progress = await progressDAO.getByUser('user123');
      expect(user123Progress).toHaveLength(1);
      expect(user123Progress[0].id).toBe('progress1');
    });

    it('should get top players by rating', async () => {
      await progressDAO.create({
        id: 'p1',
        rating: 1500,
        gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0,
        totalTime: 0, averageTime: 0, bestStreak: 0, currentStreak: 0,
        puzzlesSolved: 0, puzzleAccuracy: 0, achievements: []
      });

      await progressDAO.create({
        id: 'p2',
        rating: 1700,
        gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0,
        totalTime: 0, averageTime: 0, bestStreak: 0, currentStreak: 0,
        puzzlesSolved: 0, puzzleAccuracy: 0, achievements: []
      });

      await progressDAO.create({
        id: 'p3',
        rating: 1600,
        gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0,
        totalTime: 0, averageTime: 0, bestStreak: 0, currentStreak: 0,
        puzzlesSolved: 0, puzzleAccuracy: 0, achievements: []
      });

      const top = await progressDAO.getTopByRating(2);
      expect(top).toHaveLength(2);
      expect(top[0].rating).toBe(1700); // highest first
      expect(top[1].rating).toBe(1600);
    });
  });

  describe('Storage capabilities', () => {
    it('should handle large data storage', async () => {
      const largeMetadata = {
        moves: Array.from({ length: 1000 }, (_, i) => ({
          move: `move${i}`,
          timestamp: Date.now() + i,
          evaluation: Math.random() * 100
        })),
        analysis: {
          openingBook: Array.from({ length: 500 }, (_, i) => `opening${i}`),
          endgameTablebase: Array.from({ length: 200 }, (_, i) => `endgame${i}`)
        }
      };

      const game = await gameDAO.create({
        id: 'large-game',
        name: 'Large Test Game',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4 e5 2. Nf3 Nc6',
        metadata: largeMetadata
      });

      expect(game.metadata).toBeDefined();
      expect(game.metadata?.moves).toHaveLength(1000);

      const retrieved = await gameDAO.getById('large-game');
      expect(retrieved?.metadata?.moves).toHaveLength(1000);
      expect(retrieved?.metadata?.analysis?.openingBook).toHaveLength(500);
    });

    it('should report database size', async () => {
      await gameDAO.create({
        id: 'size-test',
        name: 'Size Test Game',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4'
      });

      const size = await getDatabaseSize();
      expect(size).toBeTypeOf('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data persistence', () => {
    it('should maintain data after clearing and recreating', async () => {
      const gameData = {
        id: 'persistence-test',
        name: 'Persistence Test',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4'
      };

      await gameDAO.create(gameData);
      
      let retrieved = await gameDAO.getById('persistence-test');
      expect(retrieved).toBeDefined();

      const initialCount = await gameDAO.count();
      expect(initialCount).toBe(1);

      retrieved = await gameDAO.getById('persistence-test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Persistence Test');
    });
  });
});