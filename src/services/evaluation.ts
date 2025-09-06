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
 * Check if a piece is hanging (undefended and can be captured)
 */
function countHangingPieces(chess: Chess, color: 'w' | 'b'): number {
  let hangingValue = 0
  const board = chess.board()
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file]
      if (!piece || piece.color !== color) continue
      
      const square = String.fromCharCode(97 + file) + (8 - rank) // Convert to algebraic notation
      
      // Check if this piece can be captured
      const attackers = chess.attackers(square, color === 'w' ? 'b' : 'w')
      if (attackers.length === 0) continue
      
      // Check if this piece is defended
      const defenders = chess.attackers(square, color)
      
      // Simple hanging detection: if more attackers than defenders, piece is hanging
      if (attackers.length > defenders.length) {
        hangingValue += MATERIAL_CP[piece.type] || 0
      }
    }
  }
  
  return hangingValue
}

/**
 * Compute evaluation including material + hanging pieces penalty.
 * Positive numbers favor White, negative favor Black.
 */
export function quickEvaluateFenWhiteCp(fen: string, _opts?: EvalOptions): number {
  const chess = new Chess(fen)
  let score = 0
  
  // Count material on board
  const board = chess.board()
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue
      const v = MATERIAL_CP[piece.type]
      score += piece.color === 'w' ? v : -v
    }
  }
  
  // Subtract value of hanging pieces
  const whiteHanging = countHangingPieces(chess, 'w')
  const blackHanging = countHangingPieces(chess, 'b')
  score -= whiteHanging
  score += blackHanging
  
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
