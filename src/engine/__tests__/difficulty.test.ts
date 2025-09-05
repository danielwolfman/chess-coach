import { describe, it, expect } from 'vitest'
import { mapLevelToEngineOptions } from '@/engine/difficulty'

describe('level → engine mapping', () => {
  it('L=1 maps to expected options', () => {
    const r = mapLevelToEngineOptions(1)
    expect(r.level).toBe(1)
    expect(r.skill).toBe(1)
    expect(r.depth).toBe(6)
    expect(r.randomness.topK).toBe(4)
    expect(r.contempt).toBe(0)
    expect(r.blunderChance).toBeCloseTo(0.02, 6)
  })

  it('L=8 maps to expected options', () => {
    const r = mapLevelToEngineOptions(8)
    expect(r.level).toBe(8)
    expect(r.skill).toBe(8)
    expect(r.depth).toBe(8) // 6 + floor(8/3) = 8
    expect(r.randomness.topK).toBe(3)
    expect(r.contempt).toBe(0)
    expect(r.blunderChance).toBe(0)
  })

  it('L=20 maps to expected options', () => {
    const r = mapLevelToEngineOptions(20)
    expect(r.level).toBe(20)
    expect(r.skill).toBe(20)
    expect(r.depth).toBe(12) // 6 + floor(20/3) = 12
    expect(r.randomness.topK).toBe(1)
    expect(r.contempt).toBe(0)
    expect(r.blunderChance).toBe(0)
  })
})

