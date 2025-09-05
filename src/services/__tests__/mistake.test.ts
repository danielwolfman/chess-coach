import { describe, it, expect } from 'vitest'
import { classifyMistake, type MistakeLabel } from '@/services/mistake'

function labelOf(res: ReturnType<typeof classifyMistake>): MistakeLabel {
  return res.label
}

describe('mistake classification - cp thresholds', () => {
  it('classifies ok when improvement or tiny loss', () => {
    // Improvement
    expect(labelOf(classifyMistake({ evalBefore: 0, evalAfter: 30 }))).toBe('ok')
    // Tiny loss 59cp
    expect(labelOf(classifyMistake({ evalBefore: 0, evalAfter: -59 }))).toBe('ok')
  })

  it('classifies inaccuracy at 60..119 cp loss', () => {
    expect(labelOf(classifyMistake({ evalBefore: 0, evalAfter: -60 }))).toBe('inaccuracy')
    expect(labelOf(classifyMistake({ evalBefore: 0, evalAfter: -119 }))).toBe('inaccuracy')
  })

  it('classifies mistake at 120..249 cp loss', () => {
    expect(labelOf(classifyMistake({ evalBefore: 0, evalAfter: -120 }))).toBe('mistake')
    expect(labelOf(classifyMistake({ evalBefore: 10, evalAfter: -239 }))).toBe('mistake')
    expect(labelOf(classifyMistake({ evalBefore: 0, evalAfter: -249 }))).toBe('mistake')
  })

  it('classifies blunder at ≥250 cp loss', () => {
    expect(labelOf(classifyMistake({ evalBefore: 0, evalAfter: -250 }))).toBe('blunder')
    expect(labelOf(classifyMistake({ evalBefore: 50, evalAfter: -350 }))).toBe('blunder')
  })
})

describe('mistake classification - softening', () => {
  it('softens thresholds by +40cp when |evalBefore| ≥ 800', () => {
    // evalBefore is decisively winning for mover; a 280cp loss is still a mistake (not blunder)
    const r = classifyMistake({ evalBefore: 800, evalAfter: 520 }) // loss 280
    expect(r.thresholds.softened).toBe(true)
    expect(r.thresholds.blunder).toBe(290)
    expect(r.cpLoss).toBe(280)
    expect(r.label).toBe('mistake')
  })

  it('no softening below 800 abs evalBefore', () => {
    const r = classifyMistake({ evalBefore: 790, evalAfter: 540 }) // loss 250
    expect(r.thresholds.softened).toBe(false)
    expect(r.label).toBe('blunder')
  })
})

describe('mistake classification - mate logic', () => {
  it('mate swing: losing your forced mate is a blunder', () => {
    const r = classifyMistake({ evalBefore: 200, evalAfter: 190, mateBefore: 3, mateAfter: undefined })
    expect(r.isMateSwing).toBe(true)
    expect(r.label).toBe('blunder')
    expect(r.notes.some(n => n.includes('lost a forced mate'))).toBe(true)
  })

  it('mate swing: allowing a forced mate is a blunder', () => {
    const r = classifyMistake({ evalBefore: 0, evalAfter: -10, mateBefore: undefined, mateAfter: -5 })
    expect(r.isMateSwing).toBe(true)
    expect(r.label).toBe('blunder')
    expect(r.notes.some(n => n.includes('allowed a forced mate'))).toBe(true)
  })

  it('tactical blunder: mate distance against mover gets closer by ≥2 moves', () => {
    const r = classifyMistake({ evalBefore: -50, evalAfter: -80, mateBefore: -5, mateAfter: -3 })
    expect(r.isTactical).toBe(true)
    expect(r.label).toBe('blunder')
    expect(r.notes.some(n => n.includes('Tactical blunder'))).toBe(true)
  })

  it('no tactical blunder when mate distance worsens by <2 moves', () => {
    const r = classifyMistake({ evalBefore: -20, evalAfter: -70, mateBefore: -5, mateAfter: -4 })
    expect(r.isTactical).toBe(false)
    // Falls back to cp-based label: loss 50 -> ok
    expect(r.label).toBe('ok')
  })

  it('improving mate distance against mover is not a blunder', () => {
    const r = classifyMistake({ evalBefore: -20, evalAfter: 10, mateBefore: -3, mateAfter: -5 })
    expect(r.isTactical).toBe(false)
    expect(r.isMateSwing).toBe(false)
    expect(r.label).toBe('ok')
  })
})

