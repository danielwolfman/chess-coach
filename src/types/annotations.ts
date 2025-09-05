import type { MistakeLabel } from '@/services/mistake'

export interface PlyAnnotation {
  ply: number
  san: string
  uci: string
  fen: string
  evalBefore: number
  evalAfter: number
  delta: number
  classification: MistakeLabel
  notes?: string[]
  timestamp?: number
}

