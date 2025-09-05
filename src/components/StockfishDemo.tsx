import React, { useMemo, useState } from 'react'
import { getStockfishEngine, selectMoveTopK } from '../engine'

export const StockfishDemo: React.FC = () => {
  const [status, setStatus] = useState<string>('Not initialized')
  const [version, setVersion] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState<boolean>(false)
  const [logs, setLogs] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<{
    bestmove?: string
    score_cp?: number
    mate?: number
    pv?: string[]
    pvs?: { multipv: number; score_cp?: number; mate?: number; pv: string[]; bestmove?: string }[]
  } | null>(null)
  const abortController = useMemo(() => new AbortController(), [])

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const initializeEngine = async () => {
    if (isInitializing) return

    setIsInitializing(true)
    setStatus('Initializing...')
    addLog('Starting Stockfish initialization...')

    try {
      const engine = getStockfishEngine()
      
      // Add message handler to capture all engine output
      engine.addMessageHandler((data: string) => {
        addLog(`Engine: ${data}`)
        if (data.startsWith('id name Stockfish')) {
          setVersion(data)
        }
      })

      // Initialize and get version
      const versionString = await engine.initialize()
      setVersion(versionString)
      setStatus('Initialized')
      addLog('✅ Engine initialized successfully!')
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Error: ${errorMsg}`)
      addLog(`❌ Initialization failed: ${errorMsg}`)
    } finally {
      setIsInitializing(false)
    }
  }

  const testCommand = async () => {
    try {
      const engine = getStockfishEngine()
      if (!engine.isReady()) {
        addLog('⚠️ Engine not ready yet')
        return
      }
      
      addLog('Sending test command: isready')
      engine.sendCommand('isready')
    } catch (error) {
      addLog(`❌ Command failed: ${error}`)
    }
  }

  const runSearch = async () => {
    try {
      const engine = getStockfishEngine()
      if (!engine.isReady()) {
        addLog('⚠️ Engine not ready yet')
        return
      }
      setSearching(true)
      setResult(null)
      const startFen = 'rn1qkbnr/pppb1ppp/4p3/3p4/3P4/5NP1/PPPNPPBP/R1BQK2R w KQkq - 0 5' // random middlegame-ish FEN
      addLog('Starting search: depth 10')
      const res = await engine.search(startFen, { depth: 10, signal: abortController.signal })
      setResult(res)
      addLog(`Search done. bestmove=${res.bestmove} cp=${res.score_cp ?? '-'} mate=${res.mate ?? '-'}`)
    } catch (e) {
      addLog(`❌ Search error: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSearching(false)
    }
  }

  const cancelSearch = () => {
    abortController.abort()
    addLog('Sent stop (abort) to engine')
  }

  const runMultiPV = async () => {
    try {
      const engine = getStockfishEngine()
      if (!engine.isReady()) {
        addLog('⚠️ Engine not ready yet')
        return
      }
      setSearching(true)
      setResult(null)
      const fen = 'rn1qkbnr/pppb1ppp/4p3/3p4/3P4/5NP1/PPPNPPBP/R1BQK2R w KQkq - 0 5'
      addLog('Starting MultiPV: N=3, depth 10')
      const res = await engine.search(fen, { depth: 10, multipv: 3, signal: abortController.signal })
      setResult(res)
      if (res.pvs) {
        addLog('Received PVs: ' + res.pvs.map(p => p.bestmove).join(', '))
      }
    } catch (e) {
      addLog(`❌ MultiPV error: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSearching(false)
    }
  }

  const sampleTopK = () => {
    if (!result?.pvs || result.pvs.length === 0) return
    const chosen = selectMoveTopK(result.pvs, 2)
    addLog(`Top-2 sample chose: ${chosen.bestmove} (cp=${chosen.score_cp ?? '-'} mate=${chosen.mate ?? '-'})`)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Stockfish Engine Demo</h2>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p><strong>Status:</strong> {status}</p>
        {version && <p><strong>Version:</strong> {version}</p>}
      </div>
      
      <div className="mb-4 space-x-2">
        <button 
          onClick={initializeEngine} 
          disabled={isInitializing}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          {isInitializing ? 'Initializing...' : 'Initialize Engine'}
        </button>
        
        <button 
          onClick={testCommand} 
          disabled={!version || isInitializing}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400"
        >
          Test Command
        </button>

        <button
          onClick={runSearch}
          disabled={!version || isInitializing || searching}
          className="px-4 py-2 bg-purple-600 text-white rounded disabled:bg-gray-400"
        >
          {searching ? 'Searching…' : 'Search Depth 10'}
        </button>

        <button
          onClick={cancelSearch}
          disabled={!searching}
          className="px-4 py-2 bg-red-600 text-white rounded disabled:bg-gray-400"
        >
          Cancel
        </button>

        <button
          onClick={runMultiPV}
          disabled={!version || isInitializing || searching}
          className="px-4 py-2 bg-indigo-600 text-white rounded disabled:bg-gray-400"
        >
          MultiPV 3 @ depth 10
        </button>

        <button
          onClick={sampleTopK}
          disabled={!result?.pvs || result.pvs.length === 0}
          className="px-4 py-2 bg-amber-600 text-white rounded disabled:bg-gray-400"
        >
          Sample Top-2
        </button>
      </div>
      
      <div className="bg-black text-green-400 p-4 rounded h-64 overflow-y-auto font-mono text-sm">
        <div className="mb-2 font-bold">Engine Log:</div>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>

      {result && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <div className="font-bold mb-1">Search Result</div>
          <div>bestmove: {result.bestmove}</div>
          <div>score_cp: {result.score_cp ?? '-'}</div>
          <div>mate: {result.mate ?? '-'}</div>
          {result.pv && <div>pv: {result.pv.join(' ')}</div>}
        </div>
      )}
    </div>
  )
}
