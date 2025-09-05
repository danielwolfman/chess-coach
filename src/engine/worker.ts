export interface StockfishWorkerMessage {
  type: 'init' | 'command' | 'quit'
  command?: string
}

export interface StockfishWorkerResponse {
  type: 'ready' | 'output' | 'error'
  data?: string
  error?: string
}

// Import the Stockfish worker directly
let stockfishWorker: Worker | null = null
let isInitialized = false

self.onmessage = async (event: MessageEvent<StockfishWorkerMessage>) => {
  const { type, command } = event.data

  try {
    switch (type) {
      case 'init':
        if (!isInitialized) {
          // Create a new worker using the stockfish.worker.js
          stockfishWorker = new Worker(
            new URL('../../node_modules/stockfish.wasm/stockfish.worker.js', import.meta.url)
          )
          
          stockfishWorker.onmessage = (e) => {
            self.postMessage({
              type: 'output',
              data: e.data
            } as StockfishWorkerResponse)
          }
          
          stockfishWorker.onerror = (error) => {
            self.postMessage({
              type: 'error',
              error: error.message
            } as StockfishWorkerResponse)
          }

          isInitialized = true
          
          // Send UCI command to initialize
          stockfishWorker.postMessage('uci')
          
          self.postMessage({
            type: 'ready',
            data: 'Stockfish worker initialized'
          } as StockfishWorkerResponse)
        }
        break

      case 'command':
        if (stockfishWorker && command) {
          stockfishWorker.postMessage(command)
        } else {
          self.postMessage({
            type: 'error',
            error: 'Engine not initialized or no command provided'
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