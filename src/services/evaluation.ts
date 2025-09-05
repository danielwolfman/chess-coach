import { Chess } from 'chess.js'

export type Color = 'w' | 'b'

export interface PlyEvalResult {
  // Centipawns from the player's perspective (positive = good for player)
  evalBefore: number
  evalAfter: number
  delta: number
}

export interface EvalOptions {
  // Reserved for future tunables (e.g., pst weights). Currently unused.
}

// Simple material values in centipawns
const MATERIAL_CP: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

/**
 * Compute a quick, deterministic material-only evaluation from White's perspective.
 * Positive numbers favor White, negative favor Black.
 */
export function quickEvaluateFenWhiteCp(fen: string, _opts?: EvalOptions): number {
  const chess = new Chess(fen)
  let score = 0
  const board = chess.board()
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue
      const v = MATERIAL_CP[piece.type]
      score += piece.color === 'w' ? v : -v
    }
  }
  return score
}

/**
 * Normalize a white-perspective centipawn score to an arbitrary player's perspective.
 * If player is White, returns as-is; if Black, returns negated.
 */
export function normalizeForPlayer(cpWhitePerspective: number, player: Color): number {
  const v = player === 'w' ? cpWhitePerspective : -cpWhitePerspective
  // Avoid -0; keep zero canonical
  return Object.is(v, -0) ? 0 : v
}

/**
 * Compute per-ply evaluation numbers around a move, from the player's perspective.
 * - evalBefore: evaluation of the position before the move
 * - evalAfter: evaluation of the position after the move
 * - delta: evalAfter - evalBefore
 * All numbers are in centipawns and consistent across color (positive is good for the mover).
 */
export function perPlyEvaluation(beforeFen: string, afterFen: string, player: Color, opts?: EvalOptions): PlyEvalResult {
  const beforeWhite = quickEvaluateFenWhiteCp(beforeFen, opts)
  const afterWhite = quickEvaluateFenWhiteCp(afterFen, opts)
  const evalBefore = normalizeForPlayer(beforeWhite, player)
  const evalAfter = normalizeForPlayer(afterWhite, player)
  return {
    evalBefore,
    evalAfter,
    delta: evalAfter - evalBefore,
  }
}

/**
 * Convenience to evaluate a single FEN from the player's perspective.
 */
export function evaluateFenForPlayer(fen: string, player: Color, opts?: EvalOptions): number {
  return normalizeForPlayer(quickEvaluateFenWhiteCp(fen, opts), player)
}
