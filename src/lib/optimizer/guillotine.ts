// Guillotine bin packing — Jylänki 2010 "A Thousand Ways to Pack the Bin",
// section 3 (Guillotine algorithm). Heuristics:
//   - Rectangle choice: BSSF (Best Short Side Fit) — Jylänki §3.2
//   - Split rule:       MAXAS (Maximize Larger Area Split) — Jylänki §3.3
//
// All inputs and outputs are in millimeters. The function is pure: no side
// effects, no I/O, deterministic given equivalent inputs and a stable sort.

import type {
  Cut,
  Offcut,
  OptimizerInput,
  OptimizerResult,
  PackedSheet,
  Part,
  Placement,
  Sheet,
} from '@/types'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface ExpandedPart {
  partId: string
  label: string
  materialId: string
  widthMm: number
  heightMm: number
  grain: Part['grain']
  rotationLocked: boolean
}

interface Orientation {
  w: number
  h: number
  rotated: boolean
}

const OFFCUT_MIN_W = 300
const OFFCUT_MIN_H = 150

function expandParts(parts: Part[]): ExpandedPart[] {
  const out: ExpandedPart[] = []
  for (const p of parts) {
    const qty = Math.max(1, Math.floor(p.quantity))
    for (let i = 0; i < qty; i++) {
      out.push({
        partId: p.id,
        label: p.label,
        materialId: p.materialId,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        grain: p.grain,
        rotationLocked: p.rotationLocked,
      })
    }
  }
  // Jylänki §3.2: sort by descending area to reduce fragmentation.
  out.sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm)
  return out
}

function orientations(part: ExpandedPart): Orientation[] {
  const natural: Orientation = { w: part.widthMm, h: part.heightMm, rotated: false }
  const rotated: Orientation = { w: part.heightMm, h: part.widthMm, rotated: true }

  switch (part.grain) {
    case 'with':
      return [natural]
    case 'across':
      return [rotated]
    case 'either':
    case 'none':
    default:
      if (part.rotationLocked) return [natural]
      if (part.widthMm === part.heightMm) return [natural]
      return [natural, rotated]
  }
}

// BSSF score — Jylänki §3.2.
// Lower is better; returns Infinity if the part doesn't fit.
function scoreBSSF(o: Orientation, free: Rect): number {
  if (o.w > free.w || o.h > free.h) return Infinity
  const leftoverHoriz = free.w - o.w
  const leftoverVert = free.h - o.h
  return Math.min(leftoverHoriz, leftoverVert)
}

interface Choice {
  rectIndex: number
  orientation: Orientation
  score: number
}

function pickBestRect(part: ExpandedPart, freeRects: Rect[]): Choice | null {
  let best: Choice | null = null
  const oris = orientations(part)
  for (let i = 0; i < freeRects.length; i++) {
    const r = freeRects[i]
    for (const o of oris) {
      const s = scoreBSSF(o, r)
      if (s === Infinity) continue
      if (!best || s < best.score) {
        best = { rectIndex: i, orientation: o, score: s }
      }
    }
  }
  return best
}

// MAXAS split — Jylänki §3.3. After placing a rect inside the free rect,
// produce two child free rects by splitting along the axis that yields the
// larger of the two children. Kerf is added so adjacent placements respect
// the saw blade gap.
function splitMaxAs(free: Rect, placed: Orientation, kerfMm: number): Rect[] {
  const remainingRight = free.w - placed.w - kerfMm
  const remainingBottom = free.h - placed.h - kerfMm

  // MAXAS: split along the axis where the produced area is larger.
  // Two candidate splits:
  //   horizontal cut: top child = full width × (h - placed - kerf),
  //                   bottom child = (w - placed - kerf) × placed.h
  //   vertical cut:   right child = (w - placed - kerf) × full height,
  //                   left child  = placed.w × (h - placed - kerf)
  const horizArea = free.w * Math.max(0, remainingBottom)
  const vertArea = free.h * Math.max(0, remainingRight)

  const out: Rect[] = []
  if (horizArea >= vertArea) {
    // Horizontal split keeps the bigger area as a full-width strip below.
    if (remainingBottom > 0) {
      out.push({
        x: free.x,
        y: free.y + placed.h + kerfMm,
        w: free.w,
        h: remainingBottom,
      })
    }
    if (remainingRight > 0) {
      out.push({
        x: free.x + placed.w + kerfMm,
        y: free.y,
        w: remainingRight,
        h: placed.h,
      })
    }
  } else {
    // Vertical split keeps the bigger area as a full-height strip on the right.
    if (remainingRight > 0) {
      out.push({
        x: free.x + placed.w + kerfMm,
        y: free.y,
        w: remainingRight,
        h: free.h,
      })
    }
    if (remainingBottom > 0) {
      out.push({
        x: free.x,
        y: free.y + placed.h + kerfMm,
        w: placed.w,
        h: remainingBottom,
      })
    }
  }
  return out
}

// Jylänki §3.4: prune free rects that are fully contained in another, since
// they can never be chosen by BSSF over the larger one.
function pruneContained(rects: Rect[]): Rect[] {
  const keep: boolean[] = rects.map(() => true)
  for (let i = 0; i < rects.length; i++) {
    if (!keep[i]) continue
    for (let j = 0; j < rects.length; j++) {
      if (i === j || !keep[j]) continue
      if (contains(rects[j], rects[i])) {
        keep[i] = false
        break
      }
    }
  }
  return rects.filter((_, i) => keep[i])
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  )
}

interface PackOutcome {
  placements: Placement[]
  placedRects: Array<Rect & { partId: string }>
  remainingFree: Rect[]
}

function packOneCopy(
  parts: ExpandedPart[],
  used: boolean[],
  sheet: Sheet,
  kerfMm: number,
): PackOutcome {
  const innerW = Math.max(0, sheet.widthMm - 2 * sheet.trimMm)
  const innerH = Math.max(0, sheet.heightMm - 2 * sheet.trimMm)
  let free: Rect[] = [
    { x: sheet.trimMm, y: sheet.trimMm, w: innerW, h: innerH },
  ]
  const placements: Placement[] = []
  const placedRects: Array<Rect & { partId: string }> = []

  for (let i = 0; i < parts.length; i++) {
    if (used[i]) continue
    const part = parts[i]
    // Material isolation: a part can only land on a sheet of the same
    // material. This is a hard constraint for woodworking — you can't put a
    // 3/4" plywood part on a 1/2" plywood sheet.
    if (part.materialId !== sheet.materialId) continue
    const choice = pickBestRect(part, free)
    if (!choice) continue

    const target = free[choice.rectIndex]
    const o = choice.orientation
    placements.push({
      partId: part.partId,
      x: target.x,
      y: target.y,
      rotated: o.rotated,
    })
    placedRects.push({
      partId: part.partId,
      x: target.x,
      y: target.y,
      w: o.w,
      h: o.h,
    })
    used[i] = true

    const split = splitMaxAs(target, o, kerfMm)
    free = [
      ...free.slice(0, choice.rectIndex),
      ...free.slice(choice.rectIndex + 1),
      ...split,
    ]
    free = pruneContained(free)
  }

  return { placements, placedRects, remainingFree: free }
}

function buildCuts(
  placedRects: Array<Rect & { partId: string }>,
  kerfMm: number,
): Cut[] {
  // Phase 1: surface a coarse cut list — one rip per unique x-edge after a
  // placement and one crosscut per unique y-edge. Useful for the cut-list
  // table in the PDF; not load-bearing for guillotine validation.
  const cuts: Cut[] = []
  const seenX = new Set<number>()
  const seenY = new Set<number>()
  let idx = 0
  for (const r of placedRects) {
    const xEdge = round3(r.x + r.w)
    if (!seenX.has(xEdge)) {
      seenX.add(xEdge)
      cuts.push({
        index: idx++,
        direction: 'rip',
        offset: xEdge,
        fromX: xEdge,
        fromY: r.y,
        toX: xEdge,
        toY: r.y + r.h,
      })
    }
    const yEdge = round3(r.y + r.h)
    if (!seenY.has(yEdge)) {
      seenY.add(yEdge)
      cuts.push({
        index: idx++,
        direction: 'crosscut',
        offset: yEdge,
        fromX: r.x,
        fromY: yEdge,
        toX: r.x + r.w,
        toY: yEdge,
      })
    }
    void kerfMm
  }
  return cuts
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function buildOffcuts(remaining: Rect[]): Offcut[] {
  return remaining
    .filter((r) => r.w >= OFFCUT_MIN_W && r.h >= OFFCUT_MIN_H)
    .map((r) => ({ x: r.x, y: r.y, widthMm: r.w, heightMm: r.h }))
}

// Mutable per-sheet state retained between the main pass and the retry pass.
// Lets the retry pass place a small unplaced part into the leftover free
// rects of a sheet that's already been packed, instead of opening a new
// dedicated sheet for a handful of small pieces.
interface SheetState {
  packedIdx: number
  sheet: Sheet
  placedRects: Array<Rect & { partId: string }>
  free: Rect[]
}

export function guillotinePack(input: OptimizerInput): OptimizerResult {
  const start = Date.now()
  const expanded = expandParts(input.parts)
  const used: boolean[] = expanded.map(() => false)

  const packedSheets: PackedSheet[] = []
  const sheetStates: SheetState[] = []

  for (const sheet of input.sheets) {
    const copies = Math.max(1, Math.floor(sheet.quantity))
    for (let copyIndex = 0; copyIndex < copies; copyIndex++) {
      if (used.every(Boolean)) break
      const remaining = expanded
        .map((p, i) => ({ ...p, _idx: i }))
        .filter((p) => !used[p._idx])
      if (remaining.length === 0) break

      const outcome = packOneCopy(expanded, used, sheet, input.kerfMm)
      if (outcome.placements.length === 0) continue

      const sheetArea = sheet.widthMm * sheet.heightMm
      const placedArea = outcome.placedRects.reduce(
        (s, r) => s + r.w * r.h,
        0,
      )
      const utilization = sheetArea > 0 ? placedArea / sheetArea : 0

      const packedIdx = packedSheets.length
      packedSheets.push({
        sheetId: sheet.id,
        copyIndex,
        utilization,
        placements: outcome.placements,
        cuts: buildCuts(outcome.placedRects, input.kerfMm),
        offcuts: buildOffcuts(outcome.remainingFree),
      })
      sheetStates.push({
        packedIdx,
        sheet,
        placedRects: outcome.placedRects.slice(),
        free: outcome.remainingFree.slice(),
      })
    }
    if (used.every(Boolean)) break
  }

  // Retry pass — for any part that wasn't placed during the main loop, try
  // every existing packed sheet's remaining free space (largest free rect
  // first) before declaring it unplaced. This prevents the pathological
  // case where 6 small parts open a new dedicated sheet at 20% utilization
  // when a previous sheet still had room for some of them.
  for (let i = 0; i < expanded.length; i++) {
    if (used[i]) continue
    const part = expanded[i]
    for (const state of sheetStates) {
      if (part.materialId !== state.sheet.materialId) continue
      const choice = pickBestRect(part, state.free)
      if (!choice) continue

      const target = state.free[choice.rectIndex]
      const o = choice.orientation
      const newPlacement: Placement = {
        partId: part.partId,
        x: target.x,
        y: target.y,
        rotated: o.rotated,
      }
      state.placedRects.push({
        partId: part.partId,
        x: target.x,
        y: target.y,
        w: o.w,
        h: o.h,
      })
      used[i] = true

      const split = splitMaxAs(target, o, input.kerfMm)
      state.free = pruneContained([
        ...state.free.slice(0, choice.rectIndex),
        ...state.free.slice(choice.rectIndex + 1),
        ...split,
      ])

      // Update the corresponding packedSheet entry in place.
      const ps = packedSheets[state.packedIdx]
      ps.placements = [...ps.placements, newPlacement]
      const sheetArea = state.sheet.widthMm * state.sheet.heightMm
      const placedArea = state.placedRects.reduce(
        (s, r) => s + r.w * r.h,
        0,
      )
      ps.utilization = sheetArea > 0 ? placedArea / sheetArea : 0
      ps.cuts = buildCuts(state.placedRects, input.kerfMm)
      ps.offcuts = buildOffcuts(state.free)
      break
    }
  }

  const unplacedPartIds: string[] = []
  for (let i = 0; i < expanded.length; i++) {
    if (!used[i]) unplacedPartIds.push(expanded[i].partId)
  }

  const totalSheets = packedSheets.length
  const averageUtilization =
    totalSheets > 0
      ? packedSheets.reduce((s, p) => s + p.utilization, 0) / totalSheets
      : 0
  const totalSheetArea = packedSheets.reduce((sum, ps) => {
    const sh = input.sheets.find((s) => s.id === ps.sheetId)
    if (!sh) return sum
    return sum + sh.widthMm * sh.heightMm
  }, 0)
  const totalPlacedArea = packedSheets.reduce(
    (sum, ps) => sum + ps.utilization * sheetAreaFor(ps, input.sheets),
    0,
  )
  const totalRemainingMm2 = Math.max(0, totalSheetArea - totalPlacedArea)

  return {
    packedSheets,
    unplacedPartIds,
    totalSheets,
    averageUtilization,
    totalRemainingMm2,
    durationMs: Date.now() - start,
  }
}

function sheetAreaFor(ps: PackedSheet, sheets: Sheet[]): number {
  const sh = sheets.find((s) => s.id === ps.sheetId)
  if (!sh) return 0
  return sh.widthMm * sh.heightMm
}

// Test-only exports — consumed by the property-based test suite.
export const __test = {
  expandParts,
  pickBestRect,
  splitMaxAs,
  pruneContained,
  contains,
}
