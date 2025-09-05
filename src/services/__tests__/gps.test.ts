import { describe, it, expect } from 'vitest'
import { computeGPS } from '@/services/gps'

describe('GPS computation', () => {
  const cases = [
    {id:'A', r: 1,  m:40, b:2,   cpl: 40,  exp: 1.257},
    {id:'B', r: 1,  m:40, b:14,  cpl: 180, exp: 0.610},
    {id:'C', r: 0,  m:60, b:5,   cpl: 60,  exp: 0.270},
    {id:'D', r:-1,  m:45, b:5,   cpl: 70,  exp:-0.680},
    {id:'E', r:-1,  m:25, b:10,  cpl: 250, exp:-1.420},
    {id:'F', r: 1,  m:30, b:0,   cpl: 0,   exp: 1.420},
    {id:'G', r: 0,  m:50, b:30,  cpl: 300, exp:-0.640},
    {id:'H', r: 0,  m:0,  b:0,   cpl: Number.NaN, exp: 0.000},
    {id:'I', r: 1,  m:20, b:4,   cpl: 120, exp: 0.900},
    {id:'J', r:-1,  m:40, b:0,   cpl: 200, exp:-1.047},
  ] as const

  it('matches reference cases to 3 decimals', () => {
    for (const t of cases) {
      const got = computeGPS({ result: t.r as -1|0|1, playerMoveCount: t.m, blunders: t.b, avgLossCp: t.cpl })
      expect(Number(got.toFixed(3))).toBeCloseTo(t.exp, 3)
      // Also verify range constraint [-2, 2]
      expect(got).toBeGreaterThanOrEqual(-2)
      expect(got).toBeLessThanOrEqual(2)
    }
  })
})
