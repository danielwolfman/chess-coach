import { describe, it, expect } from 'vitest'
import { MicroAdjustController } from '@/services/micro-adjust'

describe('Micro-adjust controller', () => {
  it('activates when ≤-700cp in 8 of last 10 plies', () => {
    const ctrl = new MicroAdjustController()
    // Feed 9 plies first: 7 bad, 2 okay => not yet active (also window < 10)
    const seq1 = [-800,-750,-710,-720,-730,-740,-705, 0, -100]
    for (const v of seq1) ctrl.update(v)
    expect(ctrl.isActive()).toBe(false)
    // 10th makes it 8 bad in last 10 => becomes active
    ctrl.update(-701)
    expect(ctrl.isActive()).toBe(true)
    // Effective level reduces by 1 but clamps at 1
    expect(ctrl.effectiveLevel(5)).toBe(4)
    expect(ctrl.effectiveLevel(1)).toBe(1)
  })

  it('auto-reverts when condition clears', () => {
    const ctrl = new MicroAdjustController()
    // Activate (8 bad out of 10)
    const seq = [-800,-750,-710,-720,-730,-740,-705, -800, -810, -820]
    for (const v of seq) ctrl.update(v)
    expect(ctrl.isActive()).toBe(true)
    // Now add good plies to slide window below threshold
    ctrl.update(0) // window now has 9 bad, 1 good -> still active
    expect(ctrl.isActive()).toBe(true)
    ctrl.update(50) // slide again; now 8 bad, 2 good -> still active
    expect(ctrl.isActive()).toBe(true)
    ctrl.update(100) // now 7 bad, 3 good -> should deactivate
    expect(ctrl.isActive()).toBe(false)
  })
})

