import React, { useState, useEffect } from 'react';
import { gameDAO, settingsDAO, progressDAO, getDatabaseSize } from '../db/indexeddb';

export default function DBDemo() {
  const [status, setStatus] = useState('Loading...');
  const [dbSize, setDbSize] = useState(0);
  const [gameCount, setGameCount] = useState(0);
  const [settings, setSettings] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);

  const updateStats = async () => {
    try {
      const [size, count, defaultSettings, defaultProgress] = await Promise.all([
        getDatabaseSize(),
        gameDAO.count(),
        settingsDAO.getDefault(),
        progressDAO.getDefault()
      ]);
      
      setDbSize(size);
      setGameCount(count);
      setSettings(defaultSettings);
      setProgress(defaultProgress);
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  };

  useEffect(() => {
    const initDemo = async () => {
      try {
        // Check if data already exists (survived reload)
        const existingSettings = await settingsDAO.getDefault();
        const existingProgress = await progressDAO.getDefault();
        const existingGameCount = await gameDAO.count();

        if (existingSettings && existingProgress && existingGameCount > 0) {
          setStatus('✅ Data survived browser reload! Database is persistent.');
        } else {
          setStatus('🔄 Initializing fresh database...');
          
          // Create initial data
          await settingsDAO.upsertDefault({
            theme: 'dark',
            soundEnabled: true,
            difficulty: 4
          });

          await progressDAO.upsertDefault({
            gamesPlayed: 25,
            gamesWon: 15,
            gamesLost: 8,
            gamesDrawn: 2,
            rating: 1350,
            achievements: ['first_game', 'ten_games', 'first_win']
          });

          // Create sample games
          for (let i = 1; i <= 3; i++) {
            await gameDAO.create({
              id: `demo-game-${i}`,
              name: `Demo Game ${i}`,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              pgn: `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ${i}. Ba4`,
              result: i % 2 === 0 ? '1-0' : '0-1'
            });
          }

          setStatus('✨ Fresh data created! Reload the page to verify persistence.');
        }

        await updateStats();
      } catch (error) {
        console.error('Demo initialization error:', error);
        setStatus('❌ Error initializing database demo');
      }
    };

    initDemo();
  }, []);

  const createLargeDataset = async () => {
    try {
      setStatus('🔄 Creating large dataset for >5MB test...');
      
      // Create a large game with extensive metadata
      const largeMetadata = {
        moves: Array.from({ length: 2000 }, (_, i) => ({
          move: `move${i}`,
          san: `N${String.fromCharCode(97 + (i % 8))}${1 + (i % 8)}`,
          timestamp: Date.now() + i,
          evaluation: (Math.random() - 0.5) * 200,
          depth: Math.floor(Math.random() * 20) + 1,
          nodes: Math.floor(Math.random() * 1000000),
          pv: Array.from({ length: 5 }, (_, j) => `pv${i}-${j}`),
          comment: `This is a detailed comment for move ${i}. `.repeat(10)
        })),
        analysis: {
          openingBook: Array.from({ length: 1000 }, (_, i) => ({
            name: `Opening ${i}`,
            eco: `A${String(i % 100).padStart(2, '0')}`,
            moves: Array.from({ length: 15 }, (_, j) => `move${i}-${j}`),
            frequency: Math.random() * 100,
            score: (Math.random() - 0.5) * 2
          })),
          endgameTablebase: Array.from({ length: 500 }, (_, i) => ({
            position: `endgame${i}`,
            result: ['win', 'draw', 'loss'][i % 3],
            moves: Math.floor(Math.random() * 50),
            evaluation: (Math.random() - 0.5) * 1000
          }))
        },
        playerData: {
          whitePlayer: {
            name: 'Demo Player White',
            rating: 1500,
            gameHistory: Array.from({ length: 100 }, (_, i) => ({
              gameId: `game${i}`,
              result: ['win', 'draw', 'loss'][i % 3],
              rating: 1500 + (Math.random() - 0.5) * 200,
              date: new Date(Date.now() - i * 86400000).toISOString()
            }))
          },
          blackPlayer: {
            name: 'Demo Player Black',
            rating: 1450,
            gameHistory: Array.from({ length: 100 }, (_, i) => ({
              gameId: `game${i}`,
              result: ['loss', 'draw', 'win'][i % 3],
              rating: 1450 + (Math.random() - 0.5) * 200,
              date: new Date(Date.now() - i * 86400000).toISOString()
            }))
          }
        }
      };

      await gameDAO.create({
        id: 'large-demo-game',
        name: 'Large Demo Game (>5MB Test)',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7',
        result: '1-0',
        metadata: largeMetadata
      });

      // Create additional games with moderate size
      for (let i = 1; i <= 10; i++) {
        const moderateMetadata = {
          moves: Array.from({ length: 100 }, (_, j) => ({
            move: `game${i}-move${j}`,
            evaluation: Math.random() * 100,
            comment: `Comment for game ${i}, move ${j}. `.repeat(5)
          }))
        };

        await gameDAO.create({
          id: `large-game-${i}`,
          name: `Large Game ${i}`,
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          pgn: `1. d4 d5 2. c4 c6 3. Nf3 Nf6 ${i}. e3`,
          metadata: moderateMetadata
        });
      }

      await updateStats();
      
      const sizeInMB = (dbSize / (1024 * 1024)).toFixed(2);
      if (dbSize > 5 * 1024 * 1024) {
        setStatus(`✅ Successfully stored >5MB of data! Current size: ${sizeInMB}MB`);
      } else {
        setStatus(`📊 Dataset created. Current size: ${sizeInMB}MB (Building to >5MB...)`);
      }
    } catch (error) {
      console.error('Error creating large dataset:', error);
      setStatus('❌ Error creating large dataset');
    }
  };

  const clearAllData = async () => {
    try {
      await gameDAO.clear();
      await settingsDAO.clear();
      await progressDAO.clear();
      await updateStats();
      setStatus('🗑️ All data cleared. Refresh to test persistence again.');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">IndexedDB Adapter Demo</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <p className="text-lg font-semibold mb-2">Status:</p>
        <p className="text-gray-700">{status}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-100 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800">Database Size</h3>
          <p className="text-2xl font-bold text-blue-900">
            {(dbSize / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>

        <div className="bg-green-100 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800">Games Stored</h3>
          <p className="text-2xl font-bold text-green-900">{gameCount}</p>
        </div>

        <div className="bg-purple-100 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-800">Persistence</h3>
          <p className="text-lg font-bold text-purple-900">
            {settings && progress ? '✅ Active' : '❌ None'}
          </p>
        </div>
      </div>

      {settings && (
        <div className="bg-white p-4 rounded-lg border mb-4">
          <h3 className="font-semibold mb-2">Settings Data:</h3>
          <pre className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </div>
      )}

      {progress && (
        <div className="bg-white p-4 rounded-lg border mb-4">
          <h3 className="font-semibold mb-2">Progress Data:</h3>
          <pre className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(progress, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <button
          onClick={createLargeDataset}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create Large Dataset (5MB+ Test)
        </button>
        
        <button
          onClick={updateStats}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          Refresh Stats
        </button>
        
        <button
          onClick={clearAllData}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Clear All Data
        </button>
      </div>

      <div className="bg-yellow-100 p-4 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">Testing Instructions:</h3>
        <ol className="list-decimal list-inside text-yellow-800 space-y-1">
          <li>Load this page fresh (creates initial data)</li>
          <li>Reload the browser to verify data persistence ✨</li>
          <li>Click "Create Large Dataset" to test 5MB+ capability 📊</li>
          <li>Check the database size indicator above</li>
          <li>Use "Clear All Data" to reset for testing</li>
        </ol>
      </div>
    </div>
  );
}