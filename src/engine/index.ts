import { StockfishWorkerMessage, StockfishWorkerResponse } from './worker'

export interface SearchOptions {
  depth?: number
  nodes?: number
  // time in milliseconds; mapped to UCI `movetime`
  time?: number
  // Optional AbortSignal to cancel search cleanly
  signal?: AbortSignal | null
  // Request multiple principal variations (MultiPV). Defaults to 1.
  multipv?: number
  // Threading preference: number of threads or 'auto'.
  // Defaults to 'auto', but depth-capped searches keep 1 for determinism unless overridden.
  threads?: number | 'auto'
}

export interface SearchResult {
  // Centipawn score from side to move perspective
  score_cp?: number
  // Mate in N (positive means side to move mates, negative means gets mated)
  mate?: number
  // Best move in UCI format
  bestmove: string
  // Primary variation as list of UCI moves
  pv?: string[]
  // When MultiPV > 1, all PV lines in evaluation order
  pvs?: PVLine[]
}

export interface PVLine {
  multipv: number
  score_cp?: number
  mate?: number
  pv: string[]
  bestmove?: string // first move of pv for convenience
}

export class StockfishEngine {
  private stockfish: Worker | null = null
  private isInitialized = false
  private initializationPromise: Promise<string> | null = null
  private messageHandlers = new Map<string, (data: string) => void>()
  private versionString: string = ''
  private activeSearchId: string | null = null

  constructor() {
    this.preload()
  }

  private async preload(): Promise<void> {
    if (!this.stockfish) {
      try {
        // Create a worker using the public Stockfish files
        this.stockfish = new Worker('/stockfish/stockfish.js')
        
        this.stockfish.addEventListener('message', (e: MessageEvent) => {
          this.handleMessage(e.data)
        })
        
        this.stockfish.addEventListener('error', (error: ErrorEvent) => {
          console.error('Stockfish Error:', error.message)
        })
      } catch (error) {
        console.error('Failed to load Stockfish:', error)
      }
    }
  }

  private handleMessage(data: string): void {
    if (data.startsWith('id name Stockfish')) {
      this.versionString = data
      this.isInitialized = true
    }
    
    this.messageHandlers.forEach((handler) => {
      handler(data)
    })
  }

  public async initialize(): Promise<string> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      if (this.isInitialized && this.versionString) {
        resolve(this.versionString)
        return
      }

      // Ensure Stockfish is loaded
      await this.preload()

      if (!this.stockfish) {
        reject(new Error('Stockfish not available'))
        return
      }

      let versionReceived = false
      const timeoutId = setTimeout(() => {
        if (!versionReceived) {
          reject(new Error('Initialization timeout'))
        }
      }, 10000) // 10 second timeout

      const messageHandler = (data: string) => {
        if (data.startsWith('id name Stockfish')) {
          this.versionString = data
          versionReceived = true
          clearTimeout(timeoutId)
          this.removeMessageHandler(messageHandler)
          resolve(data)
        }
      }

      this.addMessageHandler(messageHandler)
      this.stockfish.postMessage('uci')
    })

    return this.initializationPromise
  }

  public sendCommand(command: string): void {
    if (!this.stockfish) {
      throw new Error('Stockfish not initialized')
    }

    if (!command || typeof command !== 'string' || !command.trim()) {
      console.error('Invalid command attempted:', command)
      return
    }

    this.stockfish.postMessage(command)
  }

  private async waitForReady(timeoutMs = 5000): Promise<void> {
    await this.initialize()
    return new Promise((resolve, reject) => {
      let done = false
      const timeout = setTimeout(() => {
        if (!done) {
          cleanup()
          reject(new Error('Engine ready timeout'))
        }
      }, timeoutMs)

      const handler = (data: string) => {
        if (data.trim() === 'readyok') {
          done = true
          cleanup()
          resolve()
        }
      }

      const id = this.addMessageHandler(handler)
      const cleanup = () => {
        clearTimeout(timeout)
        this.removeMessageHandler(id)
      }

      this.sendCommand('isready')
    })
  }

  public async search(fen: string, options: SearchOptions = {}): Promise<SearchResult> {
    if (!this.isReady()) {
      await this.initialize()
    }

    if (this.activeSearchId) {
      throw new Error('Search already in progress')
    }

    // Fresh game state
    this.sendCommand('ucinewgame')
    await this.waitForReady()
    // Decide thread count
    const useDepth = options.depth != null
    const threads = typeof options.threads === 'number'
      ? Math.max(1, Math.floor(options.threads))
      : (options.threads === 'auto' || options.threads == null)
        ? (useDepth ? 1 : recommendedThreadCount())
        : 1
    this.sendCommand(`setoption name Threads value ${threads}`)
    const multipv = Math.max(1, Math.floor(options.multipv ?? 1))
    this.sendCommand(`setoption name MultiPV value ${multipv}`)

    // Position
    this.sendCommand(`position fen ${fen}`)

    // Build go command from caps; prefer explicit order depth > nodes > time
    let goCmd: string | null = null
    if (options.depth != null) {
      goCmd = `go depth ${Math.max(1, Math.floor(options.depth))}`
    } else if (options.nodes != null) {
      goCmd = `go nodes ${Math.max(1, Math.floor(options.nodes))}`
    } else if (options.time != null) {
      goCmd = `go movetime ${Math.max(1, Math.floor(options.time))}`
    } else {
      goCmd = 'go depth 10'
    }

    let lastCp: number | undefined
    let lastMate: number | undefined
    let lastPv: string[] | undefined
    const pvMap = new Map<number, PVLine>()
    let bestmove: string | null = null

    const parseInfo = (line: string) => {
      // Example: info depth 12 seldepth 21 score cp 23 nodes 12345 nps 12345 tbhits 0 time 123 pv e2e4 e7e5
      //          info depth 21 score mate 3 pv ...
      if (!line.startsWith('info ')) return
      const tokens = line.split(/\s+/)
      let mpv = 1
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]
        if (t === 'multipv' && i + 1 < tokens.length) {
          const idx = parseInt(tokens[i + 1], 10)
          if (Number.isFinite(idx) && idx >= 1) mpv = idx
        }
        if (t === 'score' && i + 2 < tokens.length) {
          const type = tokens[i + 1]
          const val = parseInt(tokens[i + 2], 10)
          if (Number.isFinite(val)) {
            if (type === 'cp') {
              lastCp = val
              lastMate = undefined
            } else if (type === 'mate') {
              lastMate = val
              lastCp = undefined
            }
          }
        }
        if (t === 'pv') {
          lastPv = tokens.slice(i + 1)
          // Track per-multipv line snapshot
          const entry: PVLine = {
            multipv: mpv,
            score_cp: lastCp,
            mate: lastMate,
            pv: lastPv,
            bestmove: lastPv[0]
          }
          pvMap.set(mpv, entry)
          break
        }
      }
    }

    const handler = (data: string) => {
      if (typeof data !== 'string') return
      const line = data.trim()
      if (line.startsWith('info ')) {
        parseInfo(line)
      } else if (line.startsWith('bestmove')) {
        const parts = line.split(/\s+/)
        bestmove = parts[1] || null
      }
    }

    const handlerId = this.addMessageHandler(handler)
    this.activeSearchId = handlerId

    // Wire up optional cancellation
    let aborted = false
    const onAbort = () => {
      if (aborted) return
      aborted = true
      try { this.sendCommand('stop') } catch {}
      // Clean up our handler immediately; bestmove will arrive shortly and be ignored
      this.removeMessageHandler(handlerId)
      this.activeSearchId = null
    }
    if (options.signal) {
      if (options.signal.aborted) onAbort()
      else options.signal.addEventListener('abort', onAbort, { once: true })
    }

    // Start search
    this.sendCommand(goCmd)

    return new Promise<SearchResult>((resolve, reject) => {
      let secondaryHandlerId: string | null = null
      const finish = (err?: Error) => {
        // Detach cancellation listener
        if (options.signal) {
          options.signal.removeEventListener('abort', onAbort as EventListener)
        }
        // Ensure handlers removed
        this.removeMessageHandler(handlerId)
        if (secondaryHandlerId) this.removeMessageHandler(secondaryHandlerId)
        this.activeSearchId = null
        if (err) reject(err)
      }

      const doneHandler = (data: string) => {
        const line = data.trim()
        if (line.startsWith('bestmove')) {
          // Already parsed in main handler; assemble result
          if (aborted) {
            finish(new DOMException('Search aborted', 'AbortError'))
            return
          }
          // Build PV list in order (multipv ascending with 1 being the best)
          const allPvs = Array.from(pvMap.values())
            .sort((a, b) => a.multipv - b.multipv)
          const top = allPvs[0]
          const result: SearchResult = {
            bestmove: bestmove || line.split(/\s+/)[1] || (top?.bestmove ?? '')
          }
          if (top?.score_cp != null) result.score_cp = top.score_cp
          if (top?.mate != null) result.mate = top.mate
          if (top?.pv && top.pv.length) result.pv = top.pv
          if (allPvs.length) result.pvs = allPvs
          finish()
          resolve(result)
        }
      }

      // Temporarily add a second lightweight handler just to detect completion quickly
      secondaryHandlerId = this.addMessageHandler(doneHandler)
    })
  }

  public addMessageHandler(handler: (data: string) => void): string {
    const id = Math.random().toString(36).substr(2, 9)
    this.messageHandlers.set(id, handler)
    return id
  }

  public removeMessageHandler(handlerOrId: ((data: string) => void) | string): void {
    if (typeof handlerOrId === 'string') {
      this.messageHandlers.delete(handlerOrId)
    } else {
      for (const [id, handler] of this.messageHandlers.entries()) {
        if (handler === handlerOrId) {
          this.messageHandlers.delete(id)
          break
        }
      }
    }
  }

  public getVersion(): string {
    return this.versionString
  }

  public isReady(): boolean {
    return this.isInitialized && !!this.versionString
  }

  public destroy(): void {
    if (this.stockfish) {
      this.stockfish.postMessage('quit')
      this.stockfish.terminate()
      this.stockfish = null
    }
    
    this.isInitialized = false
    this.initializationPromise = null
    this.messageHandlers.clear()
    this.versionString = ''
    this.activeSearchId = null
  }
}

let globalEngine: StockfishEngine | null = null

export const getStockfishEngine = (): StockfishEngine => {
  if (!globalEngine) {
    globalEngine = new StockfishEngine()
  }
  return globalEngine
}

export const preloadStockfish = (): void => {
  getStockfishEngine()
}

// Helper: select among top-k PVs (uniform random)
export function selectMoveTopK(pvs: PVLine[], k: number, random: () => number = Math.random): PVLine {
  if (!pvs || pvs.length === 0) throw new Error('No PVs to select from')
  const sorted = [...pvs].sort((a, b) => scoreOrder(b) - scoreOrder(a))
  const kk = Math.max(1, Math.min(k, sorted.length))
  const idx = Math.floor(random() * kk)
  return sorted[idx]
}

function scoreOrder(line: PVLine): number {
  if (line.mate != null) {
    // Prefer quicker mates, penalize getting mated
    const m = line.mate
    return m > 0 ? 100000 - Math.abs(m) : -100000 + Math.abs(m)
  }
  return line.score_cp ?? -Infinity
}

// Feature detection for WASM threads (SAB + Atomics + COOP/COEP)
export function supportsWasmThreads(): boolean {
  try {
    const hasSAB = typeof (globalThis as any).SharedArrayBuffer !== 'undefined'
    const hasAtomics = typeof (globalThis as any).Atomics !== 'undefined'
    const coi = (globalThis as any).crossOriginIsolated === true
    return hasSAB && hasAtomics && coi
  } catch {
    return false
  }
}

function recommendedThreadCount(): number {
  if (!supportsWasmThreads()) return 1
  const hc = (globalThis as any).navigator?.hardwareConcurrency
  if (typeof hc === 'number' && isFinite(hc) && hc > 1) {
    return Math.max(2, Math.min(4, Math.floor(hc)))
  }
  return 2
}
