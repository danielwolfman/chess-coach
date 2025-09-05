import { getStockfishEngine } from './index'

export async function testStockfishEngine(): Promise<void> {
  console.log('Testing Stockfish Engine...')
  
  try {
    const engine = getStockfishEngine()
    
    let handlerId: string | null = null
    
    // Set up message handler to capture version info
    const messageHandler = (data: string) => {
      console.log('Engine output:', data)
    }
    
    handlerId = engine.addMessageHandler(messageHandler)
    
    // Initialize the engine and get version
    const version = await engine.initialize()
    console.log('Engine initialized successfully:', version)
    
    // Clean up
    if (handlerId) {
      engine.removeMessageHandler(handlerId)
    }
    
    console.log('✅ Stockfish engine test passed!')
  } catch (error) {
    console.error('❌ Stockfish engine test failed:', error)
    throw error
  }
}

// Auto-run test when imported in development
if (import.meta.env?.DEV) {
  testStockfishEngine().catch(console.error)
}