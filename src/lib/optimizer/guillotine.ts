// Guillotine bin packing — Jylänki 2010 "A Thousand Ways to Pack the Bin",
// section 3 (Guillotine algorithm). Heuristics:
//   - Rectangle choice: BSSF (Best Short Side Fit) — Jylänki §3.2
//   - Split rule:       MAXAS (Maximize Larger Area Split) — Jylänki §3.3,
//                       or a fixed long-axis split for cutStrategy 'rip-first'
//   - Post-pass:        sheet elimination (see eliminateSheets)
//
// All inputs and outputs are in millimeters. The function is pure: no side
// effects, no I/O, deterministic given equivalent inputs and a stable sort.

import type {
  Cut,
  CutStrategy,
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
  return splitAlong(free, placed, kerfMm, horizArea >= vertArea ? 'horizontal' : 'vertical')
}

// Fixed-axis split used by the 'rip-first' strategy. Not one of Jylänki's
// §3.3 rules (those all choose the axis per placement): here the full-span
// child always runs along the sheet's long axis, so the first cut on every
// free rect is a rip. The layout degenerates into full-length strips that
// are then crosscut into parts — the table-saw-with-a-fence workflow.
function splitRipFirst(
  free: Rect,
  placed: Orientation,
  kerfMm: number,
  ripAlongX: boolean,
): Rect[] {
  return splitAlong(free, placed, kerfMm, ripAlongX ? 'horizontal' : 'vertical')
}

// Shared geometry for both split rules. 'horizontal' keeps a full-width
// child below the placement; 'vertical' keeps a full-height child to its
// right. Every child lies inside `free`.
function splitAlong(
  free: Rect,
  placed: Orientation,
  kerfMm: number,
  axis: 'horizontal' | 'vertical',
): Rect[] {
  const remainingRight = free.w - placed.w - kerfMm
  const remainingBottom = free.h - placed.h - kerfMm

  const out: Rect[] = []
  if (axis === 'horizontal') {
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

interface PlacedItem extends Rect {
  part: ExpandedPart
  rotated: boolean
}

// Per-sheet-copy working state. Kept mutable until the end so the
// sheet-elimination pass can add parts to a sheet or drop it entirely
// before PackedSheet records are built.
interface SheetState {
  sheet: Sheet
  placed: PlacedItem[]
  free: Rect[]
}

function newSheetState(sheet: Sheet): SheetState {
  const innerW = Math.max(0, sheet.widthMm - 2 * sheet.trimMm)
  const innerH = Math.max(0, sheet.heightMm - 2 * sheet.trimMm)
  return {
    sheet,
    placed: [],
    free: [{ x: sheet.trimMm, y: sheet.trimMm, w: innerW, h: innerH }],
  }
}

function cloneState(s: SheetState): SheetState {
  return { sheet: s.sheet, placed: s.placed.slice(), free: s.free.slice() }
}

// Place `part` into `state.free[choice.rectIndex]`, then split and prune the
// free list (Jylänki §3.3 / §3.4).
function placeInto(
  state: SheetState,
  part: ExpandedPart,
  choice: Choice,
  kerfMm: number,
  strategy: CutStrategy,
): void {
  const target = state.free[choice.rectIndex]
  const o = choice.orientation
  state.placed.push({
    part,
    x: target.x,
    y: target.y,
    w: o.w,
    h: o.h,
    rotated: o.rotated,
  })
  const split =
    strategy === 'rip-first'
      ? splitRipFirst(target, o, kerfMm, state.sheet.widthMm >= state.sheet.heightMm)
      : splitMaxAs(target, o, kerfMm)
  state.free = pruneContained([
    ...state.free.slice(0, choice.rectIndex),
    ...state.free.slice(choice.rectIndex + 1),
    ...split,
  ])
}

function packOneCopy(
  parts: ExpandedPart[],
  used: boolean[],
  sheet: Sheet,
  kerfMm: number,
  strategy: CutStrategy,
): SheetState {
  const state = newSheetState(sheet)
  for (let i = 0; i < parts.length; i++) {
    if (used[i]) continue
    const part = parts[i]
    // Material isolation: a part can only land on a sheet of the same
    // material. This is a hard constraint for woodworking — you can't put a
    // 3/4" plywood part on a 1/2" plywood sheet.
    if (part.materialId !== sheet.materialId) continue
    const choice = pickBestRect(part, state.free)
    if (!choice) continue
    placeInto(state, part, choice, kerfMm, strategy)
    used[i] = true
  }
  return state
}

function utilizationOf(state: SheetState): number {
  const sheetArea = state.sheet.widthMm * state.sheet.heightMm
  if (sheetArea <= 0) return 0
  return state.placed.reduce((s, r) => s + r.w * r.h, 0) / sheetArea
}

// Sheet-elimination pass. The greedy main pass fills sheet copies in order,
// so a part only ever tries sheets up to the one it lands on. Free rects
// only shrink as a sheet fills, which means an unplaced part can never fit
// anywhere afterwards — but a *placed* part may fit on a sheet that was
// opened after its own. So: take sheets in ascending utilization, try to
// move every part on one into the free space of the other sheets of the
// same material, and drop it if they all fit. Repeat until no sheet can be
// dropped. Parts only go into existing guillotine free rects, so every
// layout stays guillotine-cuttable.
function eliminateSheets(
  states: SheetState[],
  kerfMm: number,
  strategy: CutStrategy,
): SheetState[] {
  let current = states
  let improved = true
  while (improved) {
    improved = false
    const order = current
      .map((s, i) => ({ i, u: utilizationOf(s) }))
      .sort((a, b) => a.u - b.u)
    for (const { i: victimIdx } of order) {
      const victim = current[victimIdx]
      const trial = new Map<number, SheetState>()
      current.forEach((s, i) => {
        if (i !== victimIdx && s.sheet.materialId === victim.sheet.materialId) {
          trial.set(i, cloneState(s))
        }
      })
      if (trial.size === 0) continue

      // Jylänki §3.2: largest first, same ordering as the main pass.
      const parts = victim.placed
        .map((p) => p.part)
        .sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm)

      let allFit = true
      for (const part of parts) {
        let best: { host: SheetState; choice: Choice } | null = null
        for (const host of trial.values()) {
          const choice = pickBestRect(part, host.free)
          if (choice && (!best || choice.score < best.choice.score)) {
            best = { host, choice }
          }
        }
        if (!best) {
          allFit = false
          break
        }
        placeInto(best.host, part, best.choice, kerfMm, strategy)
      }
      if (!allFit) continue

      current = current
        .map((s, i) => trial.get(i) ?? s)
        .filter((_, i) => i !== victimIdx)
      improved = true
      break
    }
  }
  return current
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

export function guillotinePack(input: OptimizerInput): OptimizerResult {
  const start = Date.now()
  const expanded = expandParts(input.parts)
  const used: boolean[] = expanded.map(() => false)

  let states: SheetState[] = []

  for (const sheet of input.sheets) {
    const copies = Math.max(1, Math.floor(sheet.quantity))
    for (let copyIndex = 0; copyIndex < copies; copyIndex++) {
      if (used.every(Boolean)) break
      const state = packOneCopy(
        expanded,
        used,
        sheet,
        input.kerfMm,
        input.cutStrategy,
      )
      if (state.placed.length > 0) states.push(state)
    }
    if (used.every(Boolean)) break
  }

  states = eliminateSheets(states, input.kerfMm, input.cutStrategy)

  // Build output records. copyIndex is renumbered per sheet definition so a
  // dropped copy doesn't leave a gap.
  const copyCounter = new Map<string, number>()
  const packedSheets: PackedSheet[] = states.map((state) => {
    const copyIndex = copyCounter.get(state.sheet.id) ?? 0
    copyCounter.set(state.sheet.id, copyIndex + 1)
    return {
      sheetId: state.sheet.id,
      copyIndex,
      utilization: utilizationOf(state),
      placements: state.placed.map(
        (p): Placement => ({
          partId: p.part.partId,
          x: p.x,
          y: p.y,
          rotated: p.rotated,
        }),
      ),
      cuts: buildCuts(
        state.placed.map((p) => ({ partId: p.part.partId, x: p.x, y: p.y, w: p.w, h: p.h })),
        input.kerfMm,
      ),
      offcuts: buildOffcuts(state.free),
    }
  })

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
  splitRipFirst,
  pruneContained,
  contains,
}
