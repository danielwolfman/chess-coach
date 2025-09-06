import { getStockfishEngine, type SearchResult } from '@/engine'

export class ResignationController {
  private streak = 0
  private readonly thresholdCp = -900
  private readonly required = 3

  reset(): void {
    this.streak = 0
  }

  // Returns true when the streak threshold is reached
  update(scoreCp: number | undefined): boolean {
    if (scoreCp != null && scoreCp <= this.thresholdCp) {
      this.streak += 1
    } else {
      this.streak = 0
    }
    return this.streak >= this.required
  }
}

export interface ResignCheckResult {
  shouldResign: boolean
  reason?: string
}

// Heuristic guard + mate check:
// - If mate for opponent in <=6, resign immediately.
// - Else if lastResult suggests losing badly, perform a shallow MultiPV probe
//   to detect drawish resources (|cp| <= 100). If found, do not resign now.
export async function assessResignation(
  fen: string,
  lastResult: SearchResult,
): Promise<{ immediateMatePly: number | null; hasDrawishResource: boolean }> {
  const engine = getStockfishEngine()
  await engine.initialize()

  const mate = lastResult.mate
  if (typeof mate === 'number' && mate < 0 && Math.abs(mate) <= 6) {
    return { immediateMatePly: Math.abs(mate), hasDrawishResource: false }
  }

  // If lastResult already contains PVs, inspect them first
  const lines = lastResult.pvs ?? (lastResult.pv ? [{ multipv: 1, pv: lastResult.pv, score_cp: lastResult.score_cp }] as any : [])
  const hasDrawishInExisting = lines.some(l => (l.mate == null) && (typeof l.score_cp === 'number') && Math.abs(l.score_cp) <= 100)
  if (hasDrawishInExisting) {
    return { immediateMatePly: null, hasDrawishResource: true }
  }

  // Shallow probe to 8 plies with MultiPV to see if any resource exists
  try {
    const probe = await engine.search(fen, { depth: 8, multipv: 3 })
    const checkLines = probe.pvs ?? []
    const drawish = checkLines.some(l => (l.mate == null) && (typeof l.score_cp === 'number') && Math.abs(l.score_cp) <= 100)
    return { immediateMatePly: null, hasDrawishResource: drawish }
  } catch {
    // On any failure, be conservative and avoid resigning spuriously
    return { immediateMatePly: null, hasDrawishResource: true }
  }
}

