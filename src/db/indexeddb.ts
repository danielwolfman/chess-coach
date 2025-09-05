import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface Game {
  id: string;
  name: string;
  fen: string;
  pgn: string;
  result?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface Settings {
  id: string;
  theme: 'light' | 'dark' | 'auto';
  soundEnabled: boolean;
  difficulty: number;
  boardOrientation: 'white' | 'black';
  showCoordinates: boolean;
  analysisDepth: number;
  createdAt: number;
  updatedAt: number;
}

export interface Progress {
  id: string;
  userId?: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  totalTime: number;
  averageTime: number;
  bestStreak: number;
  currentStreak: number;
  puzzlesSolved: number;
  puzzleAccuracy: number;
  rating: number;
  achievements: string[];
  createdAt: number;
  updatedAt: number;
}

interface ChessCoachDB extends DBSchema {
  games: {
    key: string;
    value: Game;
    indexes: {
      'by-created': number;
      'by-updated': number;
      'by-result': string;
    };
  };
  settings: {
    key: string;
    value: Settings;
  };
  progress: {
    key: string;
    value: Progress;
    indexes: {
      'by-user': string;
      'by-rating': number;
    };
  };
}

const DB_NAME = 'chess-coach';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ChessCoachDB> | null = null;

async function initDB(): Promise<IDBPDatabase<ChessCoachDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ChessCoachDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        const gamesStore = db.createObjectStore('games', { keyPath: 'id' });
        gamesStore.createIndex('by-created', 'createdAt');
        gamesStore.createIndex('by-updated', 'updatedAt');
        gamesStore.createIndex('by-result', 'result');

        db.createObjectStore('settings', { keyPath: 'id' });

        const progressStore = db.createObjectStore('progress', { keyPath: 'id' });
        progressStore.createIndex('by-user', 'userId');
        progressStore.createIndex('by-rating', 'rating');
      }
    },
    blocked() {
      console.warn('Database upgrade blocked by another connection');
    },
    blocking() {
      console.warn('Database is blocking another connection upgrade');
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
    },
    terminated() {
      console.warn('Database connection terminated');
      dbInstance = null;
    },
  });

  return dbInstance;
}

class GameDAO {
  private async getDB() {
    return await initDB();
  }

  async create(game: Omit<Game, 'createdAt' | 'updatedAt'>): Promise<Game> {
    const db = await this.getDB();
    const now = Date.now();
    const fullGame: Game = {
      ...game,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.add('games', fullGame);
    return fullGame;
  }

  async getById(id: string): Promise<Game | undefined> {
    const db = await this.getDB();
    return await db.get('games', id);
  }

  async getAll(): Promise<Game[]> {
    const db = await this.getDB();
    return await db.getAll('games');
  }

  async getAllByCreated(): Promise<Game[]> {
    const db = await this.getDB();
    return await db.getAllFromIndex('games', 'by-created');
  }

  async getAllByResult(result: string): Promise<Game[]> {
    const db = await this.getDB();
    return await db.getAllFromIndex('games', 'by-result', result);
  }

  async update(id: string, updates: Partial<Omit<Game, 'id' | 'createdAt'>>): Promise<Game | null> {
    const db = await this.getDB();
    const existing = await db.get('games', id);
    
    if (!existing) {
      return null;
    }

    const updated: Game = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await db.put('games', updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const db = await this.getDB();
    const existing = await db.get('games', id);
    
    if (!existing) {
      return false;
    }

    await db.delete('games', id);
    return true;
  }

  async count(): Promise<number> {
    const db = await this.getDB();
    return await db.count('games');
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    await db.clear('games');
  }
}

class SettingsDAO {
  private async getDB() {
    return await initDB();
  }

  async create(settings: Omit<Settings, 'createdAt' | 'updatedAt'>): Promise<Settings> {
    const db = await this.getDB();
    const now = Date.now();
    const fullSettings: Settings = {
      ...settings,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.add('settings', fullSettings);
    return fullSettings;
  }

  async getById(id: string): Promise<Settings | undefined> {
    const db = await this.getDB();
    return await db.get('settings', id);
  }

  async getDefault(): Promise<Settings | undefined> {
    const db = await this.getDB();
    return await db.get('settings', 'default');
  }

  async upsertDefault(updates: Partial<Omit<Settings, 'id' | 'createdAt'>>): Promise<Settings> {
    const db = await this.getDB();
    const existing = await db.get('settings', 'default');
    const now = Date.now();
    
    if (existing) {
      const updated: Settings = {
        ...existing,
        ...updates,
        updatedAt: now,
      };
      await db.put('settings', updated);
      return updated;
    } else {
      const defaultSettings: Settings = {
        id: 'default',
        theme: 'auto',
        soundEnabled: true,
        difficulty: 3,
        boardOrientation: 'white',
        showCoordinates: true,
        analysisDepth: 3,
        ...updates,
        createdAt: now,
        updatedAt: now,
      };
      await db.add('settings', defaultSettings);
      return defaultSettings;
    }
  }

  async update(id: string, updates: Partial<Omit<Settings, 'id' | 'createdAt'>>): Promise<Settings | null> {
    const db = await this.getDB();
    const existing = await db.get('settings', id);
    
    if (!existing) {
      return null;
    }

    const updated: Settings = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await db.put('settings', updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const db = await this.getDB();
    const existing = await db.get('settings', id);
    
    if (!existing) {
      return false;
    }

    await db.delete('settings', id);
    return true;
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    await db.clear('settings');
  }
}

class ProgressDAO {
  private async getDB() {
    return await initDB();
  }

  async create(progress: Omit<Progress, 'createdAt' | 'updatedAt'>): Promise<Progress> {
    const db = await this.getDB();
    const now = Date.now();
    const fullProgress: Progress = {
      ...progress,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.add('progress', fullProgress);
    return fullProgress;
  }

  async getById(id: string): Promise<Progress | undefined> {
    const db = await this.getDB();
    return await db.get('progress', id);
  }

  async getByUser(userId: string): Promise<Progress[]> {
    const db = await this.getDB();
    return await db.getAllFromIndex('progress', 'by-user', userId);
  }

  async getDefault(): Promise<Progress | undefined> {
    const db = await this.getDB();
    return await db.get('progress', 'default');
  }

  async upsertDefault(updates: Partial<Omit<Progress, 'id' | 'createdAt'>>): Promise<Progress> {
    const db = await this.getDB();
    const existing = await db.get('progress', 'default');
    const now = Date.now();
    
    if (existing) {
      const updated: Progress = {
        ...existing,
        ...updates,
        updatedAt: now,
      };
      await db.put('progress', updated);
      return updated;
    } else {
      const defaultProgress: Progress = {
        id: 'default',
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDrawn: 0,
        totalTime: 0,
        averageTime: 0,
        bestStreak: 0,
        currentStreak: 0,
        puzzlesSolved: 0,
        puzzleAccuracy: 0,
        rating: 1200,
        achievements: [],
        ...updates,
        createdAt: now,
        updatedAt: now,
      };
      await db.add('progress', defaultProgress);
      return defaultProgress;
    }
  }

  async update(id: string, updates: Partial<Omit<Progress, 'id' | 'createdAt'>>): Promise<Progress | null> {
    const db = await this.getDB();
    const existing = await db.get('progress', id);
    
    if (!existing) {
      return null;
    }

    const updated: Progress = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await db.put('progress', updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const db = await this.getDB();
    const existing = await db.get('progress', id);
    
    if (!existing) {
      return false;
    }

    await db.delete('progress', id);
    return true;
  }

  async getTopByRating(limit: number = 10): Promise<Progress[]> {
    const db = await this.getDB();
    const tx = db.transaction('progress', 'readonly');
    const index = tx.store.index('by-rating');
    
    const results: Progress[] = [];
    let cursor = await index.openCursor(null, 'prev');
    let count = 0;
    
    while (cursor && count < limit) {
      results.push(cursor.value);
      cursor = await cursor.continue();
      count++;
    }
    
    return results;
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    await db.clear('progress');
  }
}

export const gameDAO = new GameDAO();
export const settingsDAO = new SettingsDAO();
export const progressDAO = new ProgressDAO();

export async function getDatabaseSize(): Promise<number> {
  // Guard for non-browser environments (e.g., Node test runner)
  const nav: any = (typeof navigator !== 'undefined' ? navigator : undefined) as any
  if (!nav || !nav.storage || !nav.storage.estimate) {
    return 0;
  }
  const estimate = await nav.storage.estimate();
  return estimate.usage || 0;
}

export async function clearAllData(): Promise<void> {
  await gameDAO.clear();
  await settingsDAO.clear();
  await progressDAO.clear();
}

export { initDB };
