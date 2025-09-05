export interface EngineDifficultyOptions {
  level: number
  skill: number
  depth: number
  randomness: {
    topK: number
  }
  contempt: number
  blunderChance: number // probability [0,1] to inject a blunder-y move
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

// Map app difficulty level (1–20) into engine tuning knobs.
// - depth: 6 + floor(L/3)
// - contempt: fixed 0
// - skill: clamp to 1–20 (aligned with Stockfish Skill Level range)
// - randomness: choose among top-K PV moves; K shrinks with level
// - blunderChance: very small for L1–5, 0 otherwise
export function mapLevelToEngineOptions(level: number): EngineDifficultyOptions {
  const L = Math.round(level)
  const clamped = clamp(L, 1, 20)

  // Depth grows slowly with level
  const depth = 6 + Math.floor(clamped / 3)

  // Randomness via top-K selection
  const topK = (
    clamped <= 5 ? 4 :
    clamped <= 10 ? 3 :
    clamped <= 15 ? 2 :
    1
  )

  // Tiny blunder chance for entry levels; 0 from level 6+
  const blunderTable: Record<number, number> = {
    1: 0.02,
    2: 0.015,
    3: 0.01,
    4: 0.0075,
    5: 0.005
  }
  const blunderChance = blunderTable[clamped as 1|2|3|4|5] ?? 0

  return {
    level: clamped,
    skill: clamped, // 1..20
    depth,
    randomness: { topK },
    contempt: 0,
    blunderChance
  }
}

