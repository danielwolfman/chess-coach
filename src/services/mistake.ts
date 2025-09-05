export type MistakeLabel = 'ok' | 'inaccuracy' | 'mistake' | 'blunder'

export interface MistakeClassification {
  label: MistakeLabel
  cpLoss: number // positive centipawns lost from the mover's perspective
  thresholds: { inaccuracy: number; mistake: number; blunder: number; softened: boolean }
  isMateSwing: boolean
  isTactical: boolean
  notes: string[]
}

export interface MistakeInput {
  // Evaluations from the mover's perspective in centipawns
  evalBefore: number
  evalAfter: number
  // Mate in N (moves) from mover's perspective: positive = mover mates, negative = mover gets mated
  mateBefore?: number
  mateAfter?: number
}

/**
 * Classify the quality of a move based on evaluation deltas and mate information.
 * Rules:
 * - cp thresholds (loss from mover perspective):
 *   inaccuracy: 60–119, mistake: 120–249, blunder: ≥250
 * - Soften thresholds by +40cp when |evalBefore| ≥ 800
 * - Any mate swing to worse is a blunder regardless of cp
 * - Tactical blunder note when mate distance (against mover) worsens by ≥2 moves
 */
export function classifyMistake(input: MistakeInput): MistakeClassification {
  const { evalBefore, evalAfter, mateBefore, mateAfter } = input
  const notes: string[] = []

  // Compute cp loss from mover's perspective
  const delta = evalAfter - evalBefore
  const cpLoss = delta < 0 ? -delta : 0

  // Base thresholds
  let tInacc = 60
  let tMist = 120
  let tBlun = 250

  // Soften thresholds when decisively winning/losing at move time
  const softened = Math.abs(evalBefore) >= 800
  if (softened) {
    tInacc += 40
    tMist += 40
    tBlun += 40
    notes.push('Softened thresholds (+40cp) due to decisive eval (|evalBefore| ≥ 800).')
  }

  // Mate logic helpers
  const hadMateForMoverBefore = mateBefore != null && mateBefore > 0
  const hadMateAgainstMoverBefore = mateBefore != null && mateBefore < 0
  const moverHasMateAfter = mateAfter != null && mateAfter > 0
  const moverGetsMatedAfter = mateAfter != null && mateAfter < 0

  // Any mate swing that worsens mover's prospects -> blunder
  let isMateSwing = false
  if (hadMateForMoverBefore && (mateAfter == null || mateAfter <= 0)) {
    isMateSwing = true
    notes.push('Mate swing: lost a forced mate.')
  }
  if (!hadMateAgainstMoverBefore && moverGetsMatedAfter) {
    isMateSwing = true
    notes.push('Mate swing: allowed a forced mate.')
  }

  // Tactical blunder: mate distance against mover gets closer by ≥2 moves
  let isTactical = false
  if (hadMateAgainstMoverBefore && moverGetsMatedAfter) {
    const before = Math.abs(mateBefore!)
    const after = Math.abs(mateAfter!)
    const deltaMate = before - after // positive means closer (worse)
    if (deltaMate >= 2) {
      isTactical = true
      notes.push(`Tactical blunder: mate distance worsened by ${deltaMate} moves.`)
    }
  }

  // Determine label via cp thresholds unless mate conditions force blunder
  let label: MistakeLabel = 'ok'
  if (isMateSwing || isTactical) {
    label = 'blunder'
  } else if (cpLoss >= tBlun) {
    label = 'blunder'
  } else if (cpLoss >= tMist) {
    label = 'mistake'
  } else if (cpLoss >= tInacc) {
    label = 'inaccuracy'
  } else {
    label = 'ok'
  }

  if (cpLoss > 0) notes.push(`Loss: ${cpLoss} cp`)

  return {
    label,
    cpLoss,
    thresholds: { inaccuracy: tInacc, mistake: tMist, blunder: tBlun, softened },
    isMateSwing,
    isTactical,
    notes,
  }
}

