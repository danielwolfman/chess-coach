import { settingsDAO } from '@/db/indexeddb'

export function levelDeltaFromGPS(gps: number): number {
  if (gps >= 1.2) return 2
  if (gps >= 0.6) return 1
  if (gps <= -1.2) return -2
  if (gps <= -0.6) return -1
  return 0
}

export function clampLevel(level: number): number {
  return Math.max(1, Math.min(20, Math.round(level)))
}

export function adjustLevel(currentLevel: number, gps: number): number {
  const delta = levelDeltaFromGPS(gps)
  return clampLevel(currentLevel + delta)
}

export async function applyLevelUpdateFromGPS(gps: number): Promise<{ oldLevel: number, newLevel: number, delta: number }>{
  // Ensure default settings exists
  const existing = await settingsDAO.getDefault() ?? await settingsDAO.upsertDefault({})
  const oldLevel = existing.difficulty
  const delta = levelDeltaFromGPS(gps)
  const desired = oldLevel + delta
  const newLevel = clampLevel(desired)
  if (newLevel !== oldLevel) {
    await settingsDAO.upsertDefault({ difficulty: newLevel })
  }
  return { oldLevel, newLevel, delta }
}

