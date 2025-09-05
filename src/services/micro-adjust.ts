export interface MicroAdjustConfig {
  windowSize: number // number of recent player plies to consider
  minCountAtOrBelow: number // required count in window
  cpThreshold: number // player's evalAfter must be <= this (player POV)
}

export interface MicroAdjustState {
  active: boolean
}

const DEFAULT_CONFIG: MicroAdjustConfig = {
  windowSize: 10,
  minCountAtOrBelow: 8,
  cpThreshold: -700,
}

export class MicroAdjustController {
  private cfg: MicroAdjustConfig
  private window: number[] = []
  private state: MicroAdjustState = { active: false }

  constructor(cfg: Partial<MicroAdjustConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg }
  }

  // Update with the player's evalAfter (player POV). Returns current active flag.
  update(playerEvalAfterCp: number): boolean {
    // push into window
    this.window.push(playerEvalAfterCp)
    if (this.window.length > this.cfg.windowSize) {
      this.window.shift()
    }
    this.recompute()
    return this.state.active
  }

  // Whether micro-adjust should apply right now
  isActive(): boolean {
    return this.state.active
  }

  // Compute effective level for coaching; does not alter any persisted difficulty
  effectiveLevel(baseLevel: number): number {
    const l = Math.round(baseLevel)
    if (!this.state.active) return clamp(l, 1, 20)
    return clamp(l - 1, 1, 20)
  }

  // Clear internal window (e.g., on new game)
  reset(): void {
    this.window = []
    this.state.active = false
  }

  private recompute(): void {
    if (this.window.length < this.cfg.windowSize) {
      // Not enough data to trigger
      this.state.active = false
      return
    }
    const count = this.window.reduce((acc, v) => acc + (v <= this.cfg.cpThreshold ? 1 : 0), 0)
    this.state.active = count >= this.cfg.minCountAtOrBelow
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

