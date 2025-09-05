export type Result = -1 | 0 | 1

export interface GameStatsForGPS {
  result: Result // from player POV
  playerMoveCount: number // >= 0
  blunders: number // >= 0
  avgLossCp?: number | null // >= 0, mean of positive deltas on player moves
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x))

// Compute GPS per spec. All sub-terms are clamped before weighting.
export function computeGPS(g: GameStatsForGPS): number {
  const moves = Math.max(0, Math.floor(g.playerMoveCount))
  const blunders = Math.min(Math.max(0, Math.floor(g.blunders)), moves)

  // Neutral fallbacks when data is missing or no moves
  const neutralBlunderRate = 0.20
  const neutralAvgLossCp = 120

  const blunderRate = moves > 0 ? (blunders / moves) : neutralBlunderRate

  let avgLossCp = g.avgLossCp ?? neutralAvgLossCp
  if (!Number.isFinite(avgLossCp) || avgLossCp < 0) avgLossCp = neutralAvgLossCp

  const termResult = 0.9 * clamp(g.result, -1, 1)
  const termBlunders = 0.6 * clamp(0.20 - blunderRate, -1, 1)
  const termAvgLoss = 0.4 * clamp((120 - avgLossCp) / 120, -1, 1)

  return termResult + termBlunders + termAvgLoss
}

