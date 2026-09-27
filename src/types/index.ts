export type Unit = 'mm' | 'in'
export type Grain = 'with' | 'across' | 'either' | 'none'
export type CutStrategy = 'yield' | 'rip-first'
export type Algorithm = 'guillotine' | 'maxrects' | 'mixed'

export interface Material {
  id: string
  name: string
  thicknessMm: number
  hasGrain: boolean
  costPerSheet?: number
}

export interface Sheet {
  id: string
  materialId: string
  widthMm: number
  heightMm: number
  quantity: number
  trimMm: number
}

export interface Part {
  id: string
  label: string
  materialId: string
  widthMm: number
  heightMm: number
  quantity: number
  grain: Grain
  rotationLocked: boolean
  edgeBanding?: {
    top?: boolean
    right?: boolean
    bottom?: boolean
    left?: boolean
  }
}

export interface Placement {
  partId: string
  x: number
  y: number
  rotated: boolean
}

// One saw cut, in the order it is made. Every cut runs edge-to-edge across
// the piece it divides (the sheet, or a piece left by earlier cuts).
//
// A piece's reference edges are its low-x and low-y edges: a jointed trim, an
// earlier saw cut, or a factory edge when there is no trim. The fence is set
// from the reference edge to the cut line.
export interface Cut {
  /** 0-based position in the full sequence, trims first. */
  index: number
  /** 'trim' squares up the sheet edges; 'part' separates parts and offcuts. */
  kind: 'trim' | 'part'
  /** Display label: "T1", "T2", ... for trims, "1", "2", ... for part cuts. */
  label: string
  /** 'rip' runs along the sheet's long axis, 'crosscut' across it. */
  direction: 'rip' | 'crosscut'
  /** Absolute position of the cut line, mm from the sheet's x=0 or y=0 edge. */
  offset: number
  /**
   * Fence setting in mm: distance from the reference edge of the piece being
   * cut to the cut line. null for the two jointing trims (T1, T2), which
   * create the reference edges rather than cutting from them.
   */
  fenceMm: number | null
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface Offcut {
  x: number
  y: number
  widthMm: number
  heightMm: number
}

export interface PackedSheet {
  sheetId: string
  copyIndex: number
  utilization: number
  placements: Placement[]
  cuts: Cut[]
  offcuts: Offcut[]
}

export interface Project {
  id: string
  name: string
  unit: Unit
  kerfMm: number
  cutStrategy: CutStrategy
  algorithm: Algorithm
  sheets: Sheet[]
  parts: Part[]
  results?: OptimizerResult
}

export interface OptimizerInput {
  parts: Part[]
  sheets: Sheet[]
  materials: Material[]
  kerfMm: number
  cutStrategy: CutStrategy
  algorithm: Algorithm
}

export interface OptimizerResult {
  packedSheets: PackedSheet[]
  unplacedPartIds: string[]
  totalSheets: number
  averageUtilization: number
  totalRemainingMm2: number
  durationMs: number
}

export type OptimizerProgress = {
  type: 'progress'
  generation: number
  bestUtilization: number
}

export type OptimizerMessage =
  | OptimizerProgress
  | { type: 'result'; result: OptimizerResult }
  | { type: 'error'; message: string }

export class InvalidDimensionError extends Error {
  constructor(input: string, reason?: string) {
    super(`Invalid dimension "${input}"${reason ? `: ${reason}` : ''}`)
    this.name = 'InvalidDimensionError'
  }
}
