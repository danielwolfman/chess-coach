export interface StockfishWorkerMessage {
  type: 'init' | 'command' | 'quit'
  command?: string
}

export interface StockfishWorkerResponse {
  type: 'ready' | 'output' | 'error'
  data?: string
  error?: string
}

// Simple stockfish worker wrapper
let stockfishWorker: Worker | null = null
let isInitialized = false

self.onmessage = async (event: MessageEvent<StockfishWorkerMessage>) => {
  const { type, command } = event.data

  try {
    switch (type) {
      case 'init':
        if (!isInitialized) {
          try {
            // Import stockfish and create worker directly
            const stockfishModule = await import('stockfish')
            const Stockfish = stockfishModule.default
            
            // Stockfish() returns a Worker
            stockfishWorker = Stockfish()
            
            stockfishWorker.addEventListener('message', (e: MessageEvent) => {
              self.postMessage({
                type: 'output',
                data: e.data
              } as StockfishWorkerResponse)
            })

            stockfishWorker.addEventListener('error', (error: ErrorEvent) => {
              self.postMessage({
                type: 'error',
                error: `Stockfish worker error: ${error.message}`
              } as StockfishWorkerResponse)
            })

            isInitialized = true
            
            // Send UCI command to initialize
            stockfishWorker.postMessage('uci')
            
            self.postMessage({
              type: 'ready',
              data: 'Stockfish worker initialized'
            } as StockfishWorkerResponse)
          } catch (error) {
            self.postMessage({
              type: 'error',
              error: `Stockfish initialization failed: ${error instanceof Error ? error.message : error}`
            } as StockfishWorkerResponse)
          }
        }
        break

      case 'command':
        if (stockfishWorker && command && typeof command === 'string' && command.trim()) {
          stockfishWorker.postMessage(command)
        } else {
          self.postMessage({
            type: 'error',
            error: `Engine not initialized or invalid command provided: ${command}`
          } as StockfishWorkerResponse)
        }
        break

      case 'quit':
        if (stockfishWorker) {
          stockfishWorker.postMessage('quit')
          stockfishWorker.terminate()
          stockfishWorker = null
          isInitialized = false
        }
        break

      default:
        self.postMessage({
          type: 'error',
          error: `Unknown message type: ${type}`
        } as StockfishWorkerResponse)
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    } as StockfishWorkerResponse)
  }
}