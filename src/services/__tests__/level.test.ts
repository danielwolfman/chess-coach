import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { levelDeltaFromGPS, adjustLevel, applyLevelUpdateFromGPS } from '@/services/level'
import { settingsDAO, clearAllData } from '@/db/indexeddb'

describe('Level updates from GPS', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('maps GPS to deltas correctly', () => {
    expect(levelDeltaFromGPS(1.3)).toBe(2)
    expect(levelDeltaFromGPS(0.6)).toBe(1)
    expect(levelDeltaFromGPS(0.59)).toBe(0)
    expect(levelDeltaFromGPS(-0.6)).toBe(-1)
    expect(levelDeltaFromGPS(-1.2)).toBe(-2)
    expect(levelDeltaFromGPS(0)).toBe(0)
  })

  it('clamps adjustments within [1,20]', () => {
    // upward clamps
    expect(adjustLevel(20, 1.3)).toBe(20)
    expect(adjustLevel(19, 1.3)).toBe(20)
    expect(adjustLevel(20, 0.6)).toBe(20)
    // downward clamps
    expect(adjustLevel(1, -1.3)).toBe(1)
    expect(adjustLevel(2, -1.3)).toBe(1)
    expect(adjustLevel(1, -0.6)).toBe(1)
  })

  it('persists updated level across boundaries 1 and 20', async () => {
    // Initialize default settings
    await settingsDAO.upsertDefault({ difficulty: 1 })
    // Strongly negative GPS tries to drop by 2, but clamps to 1
    let res = await applyLevelUpdateFromGPS(-1.5)
    expect(res.oldLevel).toBe(1)
    expect(res.delta).toBe(-2)
    expect(res.newLevel).toBe(1)
    let s = await settingsDAO.getDefault()
    expect(s?.difficulty).toBe(1)

    // Raise near top and clamp at 20
    await settingsDAO.upsertDefault({ difficulty: 19 })
    res = await applyLevelUpdateFromGPS(1.5)
    expect(res.oldLevel).toBe(19)
    expect(res.delta).toBe(2)
    expect(res.newLevel).toBe(20)
    s = await settingsDAO.getDefault()
    expect(s?.difficulty).toBe(20)

    // At 20 with positive GPS stays 20
    res = await applyLevelUpdateFromGPS(0.8)
    expect(res.oldLevel).toBe(20)
    expect(res.delta).toBe(1)
    expect(res.newLevel).toBe(20)
    s = await settingsDAO.getDefault()
    expect(s?.difficulty).toBe(20)

    // At 20 negative step drops to 19
    res = await applyLevelUpdateFromGPS(-0.8)
    expect(res.oldLevel).toBe(20)
    expect(res.delta).toBe(-1)
    expect(res.newLevel).toBe(19)
    s = await settingsDAO.getDefault()
    expect(s?.difficulty).toBe(19)
  })
})

