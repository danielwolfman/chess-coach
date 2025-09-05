import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { gameDAO, clearAllData } from '@/db/indexeddb'

describe('DB persistence - per-move annotations', () => {
  beforeEach(async () => {
    await clearAllData()
  })
  afterEach(async () => {
    await clearAllData()
  })

  it('persists annotations in metadata and returns same on reload', async () => {
    const id = 'db-annotations-1'
    const meta = {
      annotations: {
        '1': { ply: 1, san: 'e4', uci: 'e2e4', fen: 'fen1', evalBefore: 0, evalAfter: 0, delta: 0, classification: 'ok' },
        '2': { ply: 2, san: 'e5', uci: 'e7e5', fen: 'fen2', evalBefore: 0, evalAfter: 0, delta: 0, classification: 'ok' },
      },
    }
    await gameDAO.create({ id, name: 'Game', fen: 'fen2', pgn: '1. e4 e5', metadata: meta })

    const g1 = await gameDAO.getById(id)
    expect(g1?.metadata?.annotations).toBeDefined()
    expect(Object.keys(g1!.metadata!.annotations)).toHaveLength(2)

    // Update by adding another annotation
    const meta2 = { ...g1!.metadata, annotations: { ...g1!.metadata!.annotations, '3': { ply: 3, san: 'Nf3', uci: 'g1f3', fen: 'fen3', evalBefore: 0, evalAfter: 0, delta: 0, classification: 'ok' } } }
    await gameDAO.update(id, { metadata: meta2 })

    const g2 = await gameDAO.getById(id)
    expect(Object.keys(g2!.metadata!.annotations)).toHaveLength(3)
    expect(g2!.metadata!.annotations['3'].san).toBe('Nf3')
  })
})

