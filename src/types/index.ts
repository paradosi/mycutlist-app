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

export interface Cut {
  index: number
  direction: 'rip' | 'crosscut'
  offset: number
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
