import { describe, it, expect, beforeEach, vi } from 'vitest'
import AutoSaveService from '@/services/autosave'
import { gameDAO } from '@/db/indexeddb'
import type { PlyAnnotation } from '@/types/annotations'
import { ChessGame } from '@/rules/chess'

vi.mock('@/db/indexeddb', () => ({
  gameDAO: {
    getById: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}))

describe('AutoSaveService - per-move annotations persistence', () => {
  const mockDAO = gameDAO as unknown as {
    getById: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }

  let service: AutoSaveService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AutoSaveService({ debounceMs: 10 })
  })

  it('creates new row including annotations map', async () => {
    const g = new ChessGame()
    g.move('e4')
    const state = g.getState()
    const gameId = 'ann-create-1'

    const annotations: Record<string, PlyAnnotation> = {
      '1': {
        ply: 1,
        san: 'e4',
        uci: 'e2e4',
        fen: state.fen,
        evalBefore: 0,
        evalAfter: 0,
        delta: 0,
        classification: 'ok',
      },
    }

    mockDAO.getById.mockResolvedValue(null)
    mockDAO.create.mockResolvedValue({})

    service.saveAfterMove(gameId, state, undefined, annotations)

    await new Promise(r => setTimeout(r, 20))

    expect(mockDAO.create).toHaveBeenCalledWith(expect.objectContaining({
      id: gameId,
      metadata: expect.objectContaining({
        lastMove: expect.any(Object),
        evaluations: undefined,
        annotations,
        autoSavedAt: expect.any(Number),
      }),
    }))
  })

  it('updates existing row and merges annotations map', async () => {
    const g = new ChessGame()
    g.move('e4')
    const state = g.getState()
    const gameId = 'ann-update-1'

    const existing = { id: gameId, name: 'x', fen: 'f', pgn: 'p', metadata: { any: true } }
    mockDAO.getById.mockResolvedValue(existing)
    mockDAO.update.mockResolvedValue({})

    const annotations: Record<string, PlyAnnotation> = {
      '1': { ply: 1, san: 'e4', uci: 'e2e4', fen: state.fen, evalBefore: 0, evalAfter: 0, delta: 0, classification: 'ok' },
      '2': { ply: 2, san: 'e5', uci: 'e7e5', fen: state.fen, evalBefore: 0, evalAfter: 0, delta: 0, classification: 'ok' },
    }

    service.saveAfterMove(gameId, state, { '1': 0 }, annotations)

    await new Promise(r => setTimeout(r, 20))

    expect(mockDAO.update).toHaveBeenCalledWith(gameId, expect.objectContaining({
      metadata: expect.objectContaining({
        any: true,
        evaluations: { '1': 0 },
        annotations,
        lastMove: expect.any(Object),
        autoSavedAt: expect.any(Number),
      }),
    }))
  })
})

