import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { perPlyEvaluation, quickEvaluateFenWhiteCp, normalizeForPlayer, evaluateFenForPlayer } from '@/services/evaluation'

describe('evaluation service - material and normalization', () => {
  it('quickEvaluateFenWhiteCp returns 0 for the starting position', () => {
    const fen = new Chess().fen()
    expect(quickEvaluateFenWhiteCp(fen)).toBe(0)
  })

  it('normalizeForPlayer flips sign for black', () => {
    expect(normalizeForPlayer(50, 'w')).toBe(50)
    expect(normalizeForPlayer(50, 'b')).toBe(-50)
    expect(normalizeForPlayer(-120, 'b')).toBe(120)
  })

  it('evaluateFenForPlayer is consistent across color', () => {
    const chess = new Chess()
    // Create a simple material imbalance: remove a white pawn
    // FEN: start, then remove pawn on a2
    chess.remove('a2')
    const fen = chess.fen()
    const whiteCp = quickEvaluateFenWhiteCp(fen)
    expect(whiteCp).toBeLessThan(0) // black is up material
    expect(evaluateFenForPlayer(fen, 'w')).toBe(whiteCp)
    expect(evaluateFenForPlayer(fen, 'b')).toBe(-whiteCp)
  })
})

describe('per-ply evaluation pipeline', () => {
  it('returns stable numbers across color: no-material-change move', () => {
    const g = new Chess()
    const beforeFen = g.fen()
    // White plays e4
    g.move('e4')
    const afterFen = g.fen()
    const resWhite = perPlyEvaluation(beforeFen, afterFen, 'w')
    // Material-only eval should remain 0 (no capture)
    expect(resWhite.evalBefore).toBe(0)
    expect(resWhite.evalAfter).toBe(0)
    expect(resWhite.delta).toBe(0)

    // If we view same fens from black perspective, signs flip
    const resBlackPerspective = perPlyEvaluation(beforeFen, afterFen, 'b')
    expect(resBlackPerspective.evalBefore).toBe(0)
    expect(resBlackPerspective.evalAfter).toBe(0)
    expect(resBlackPerspective.delta).toBe(0)
  })

  it('delta reflects a beneficial capture for the mover', () => {
    const g = new Chess()
    // Sequence leading to a white pawn capture: 1.e4 d5 2.exd5
    g.move('e4')
    g.move('d5')
    const beforeFen = g.fen() // before white captures on d5
    g.move('exd5')
    const afterFen = g.fen()

    const res = perPlyEvaluation(beforeFen, afterFen, 'w')
    // White has won a pawn -> positive delta ~ +100
    expect(res.evalBefore).toBe(0)
    expect(res.evalAfter).toBe(100)
    expect(res.delta).toBe(100)
  })

  it('delta reflects a beneficial capture for black', () => {
    const g = new Chess()
    // 1.e4 d5 2.exd5 Qxd5 (black recaptures winning a queen? No: just recapture pawn)
    g.move('e4')
    g.move('d5')
    g.move('exd5')
    const beforeFen = g.fen() // before black recaptures on d5
    g.move('Qxd5')
    const afterFen = g.fen()

    const res = perPlyEvaluation(beforeFen, afterFen, 'b')
    // Material returns to level -> delta should be +100 for black (regaining pawn)
    expect(res.evalAfter - res.evalBefore).toBe(100)
    expect(res.delta).toBe(100)
  })
})

