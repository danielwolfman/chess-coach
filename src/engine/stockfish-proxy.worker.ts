// Proxy worker that wraps the 'stockfish' npm package and forwards
// its stdout lines back to the main thread. The main thread can send
// plain string commands (e.g., 'uci', 'isready', 'position ...', 'go ...').

let engine: Worker | null = null

async function ensureEngine(): Promise<Worker> {
  if (engine) return engine
  const mod = await import('stockfish')
  const create = (mod as any).default as () => Worker
  engine = create()
  engine.addEventListener('message', (e: MessageEvent) => {
    ;(self as any).postMessage(e.data)
  })
  engine.addEventListener('error', (err: ErrorEvent) => {
    ;(self as any).postMessage(`error ${err && err.message ? err.message : 'unknown'}`)
  })
  return engine
}

self.addEventListener('message', async (e: MessageEvent) => {
  const data = e.data
  try {
    const eng = await ensureEngine()
    if (typeof data === 'string') {
      eng.postMessage(data)
    } else if (data && typeof data.command === 'string') {
      eng.postMessage(data.command)
    } else if (data && data.type === 'quit') {
      try { eng.postMessage('quit') } catch {}
      try { eng.terminate() } catch {}
    }
  } catch (error) {
    ;(self as any).postMessage(`error ${error instanceof Error ? error.message : 'unknown'}`)
  }
})

