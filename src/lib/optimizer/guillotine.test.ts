import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { guillotinePack, __test } from './guillotine'
import type { CutStrategy, OptimizerInput, Part, Sheet, Material } from '@/types'

const MATERIAL: Material = {
  id: 'mat-1',
  name: 'Plywood',
  thicknessMm: 19.05,
  hasGrain: true,
}

function buildInput(
  parts: Part[],
  sheets: Sheet[],
  kerfMm = 3.175,
  cutStrategy: CutStrategy = 'yield',
): OptimizerInput {
  return {
    parts,
    sheets,
    materials: [MATERIAL],
    kerfMm,
    cutStrategy,
    algorithm: 'guillotine',
  }
}

function dimsFor(part: Part, rotated: boolean): { w: number; h: number } {
  return rotated
    ? { w: part.heightMm, h: part.widthMm }
    : { w: part.widthMm, h: part.heightMm }
}

describe('guillotinePack — material isolation', () => {
  it('places parts only on sheets matching their material', () => {
    const matA: Material = { ...MATERIAL, id: 'mat-a', name: 'Plywood A' }
    const matB: Material = { ...MATERIAL, id: 'mat-b', name: 'Plywood B' }
    const parts: Part[] = [
      {
        id: 'p-a',
        label: 'PartA',
        materialId: 'mat-a',
        widthMm: 600,
        heightMm: 400,
        quantity: 1,
        grain: 'none',
        rotationLocked: false,
      },
      {
        id: 'p-b',
        label: 'PartB',
        materialId: 'mat-b',
        widthMm: 600,
        heightMm: 400,
        quantity: 1,
        grain: 'none',
        rotationLocked: false,
      },
    ]
    const sheets: Sheet[] = [
      {
        id: 's-a',
        materialId: 'mat-a',
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 1,
        trimMm: 3.175,
      },
      {
        id: 's-b',
        materialId: 'mat-b',
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 1,
        trimMm: 3.175,
      },
    ]
    const result = guillotinePack({
      parts,
      sheets,
      materials: [matA, matB],
      kerfMm: 3.175,
      cutStrategy: 'yield',
      algorithm: 'guillotine',
    })
    expect(result.unplacedPartIds).toHaveLength(0)
    for (const ps of result.packedSheets) {
      const sheet = sheets.find((s) => s.id === ps.sheetId)!
      for (const pl of ps.placements) {
        const part = parts.find((p) => p.id === pl.partId)!
        expect(part.materialId).toBe(sheet.materialId)
      }
    }
  })

  it('reports parts as unplaced when no sheet has matching material', () => {
    const parts: Part[] = [
      {
        id: 'p-orphan',
        label: 'Orphan',
        materialId: 'mat-nonexistent',
        widthMm: 200,
        heightMm: 200,
        quantity: 1,
        grain: 'none',
        rotationLocked: false,
      },
    ]
    const sheets: Sheet[] = [
      {
        id: 's-1',
        materialId: 'mat-other',
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 1,
        trimMm: 3.175,
      },
    ]
    const result = guillotinePack({
      parts,
      sheets,
      materials: [MATERIAL],
      kerfMm: 3.175,
      cutStrategy: 'yield',
      algorithm: 'guillotine',
    })
    expect(result.unplacedPartIds).toContain('p-orphan')
    expect(result.packedSheets).toHaveLength(0)
  })
})

describe('guillotinePack — filling a sheet before opening the next', () => {
  it('places small parts in the leftover space of the current copy rather than opening a new one', () => {
    // One large 4×8 sheet, one big panel that fits with room left,
    // and 4 small pieces that should slot into the leftover area.
    const parts: Part[] = [
      {
        id: 'big',
        label: 'Big',
        materialId: MATERIAL.id,
        widthMm: 1800, // 70.9"
        heightMm: 800, // 31.5"
        quantity: 1,
        grain: 'none',
        rotationLocked: false,
      },
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `s-${i}`,
        label: `Small${i}`,
        materialId: MATERIAL.id,
        widthMm: 200,
        heightMm: 150,
        quantity: 1,
        grain: 'none' as const,
        rotationLocked: false,
      })),
    ]
    const sheets: Sheet[] = [
      {
        id: 'sheet-only',
        materialId: MATERIAL.id,
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 5,
        trimMm: 3.175,
      },
    ]
    const result = guillotinePack(buildInput(parts, sheets))
    expect(result.unplacedPartIds).toHaveLength(0)
    // All parts must land on a single sheet copy: one big + four small.
    expect(result.packedSheets.length).toBe(1)
    expect(result.packedSheets[0].placements.length).toBe(5)
  })
})

describe('guillotinePack — sheet elimination', () => {
  function part(id: string, widthMm: number, heightMm: number): Part {
    return {
      id,
      label: id,
      materialId: MATERIAL.id,
      widthMm,
      heightMm,
      quantity: 1,
      grain: 'with',
      rotationLocked: false,
    }
  }

  it('drops a sheet whose parts all fit in the free space of a later sheet', () => {
    // The greedy pass fills the small sheet first: the panel doesn't fit it,
    // the strip does. The panel then opens the big sheet, which has room
    // for the strip too. Without elimination this uses two sheets.
    const sheets: Sheet[] = [
      { id: 'small', materialId: MATERIAL.id, widthMm: 600, heightMm: 600, quantity: 1, trimMm: 0 },
      { id: 'big', materialId: MATERIAL.id, widthMm: 2438.4, heightMm: 1219.2, quantity: 1, trimMm: 0 },
    ]
    const result = guillotinePack(
      buildInput([part('panel', 2000, 1000), part('strip', 590, 100)], sheets),
    )
    expect(result.unplacedPartIds).toHaveLength(0)
    expect(result.totalSheets).toBe(1)
    expect(result.packedSheets[0].sheetId).toBe('big')
    expect(result.packedSheets[0].copyIndex).toBe(0)
    expect(result.packedSheets[0].placements.map((p) => p.partId).sort()).toEqual([
      'panel',
      'strip',
    ])
  })

  it('never moves parts onto a sheet of a different material', () => {
    const other: Sheet = {
      id: 'big-other',
      materialId: 'mat-other',
      widthMm: 2438.4,
      heightMm: 1219.2,
      quantity: 1,
      trimMm: 0,
    }
    const sheets: Sheet[] = [
      { id: 'small', materialId: MATERIAL.id, widthMm: 600, heightMm: 600, quantity: 1, trimMm: 0 },
      other,
    ]
    const panel: Part = { ...part('panel', 2000, 1000), materialId: 'mat-other' }
    const result = guillotinePack(buildInput([panel, part('strip', 590, 100)], sheets))
    expect(result.totalSheets).toBe(2)
  })
})

describe('guillotinePack — cut strategy', () => {
  // A 1000×1000 part leaves a 1440-wide strip to its right and a 220-high
  // strip below. MAXAS keeps the larger area full-height on the right;
  // rip-first always keeps a full-length rip below instead.
  const parts: Part[] = [
    { id: 'A', label: 'A', materialId: MATERIAL.id, widthMm: 1000, heightMm: 1000, quantity: 1, grain: 'with', rotationLocked: false },
    { id: 'B', label: 'B', materialId: MATERIAL.id, widthMm: 1400, heightMm: 210, quantity: 1, grain: 'with', rotationLocked: false },
  ]
  const sheets: Sheet[] = [
    { id: 's', materialId: MATERIAL.id, widthMm: 2440, heightMm: 1220, quantity: 1, trimMm: 0 },
  ]

  it("'yield' uses MAXAS: B goes into the full-height strip beside A", () => {
    const [, b] = guillotinePack(buildInput(parts, sheets, 0, 'yield')).packedSheets[0].placements
    expect({ x: b.x, y: b.y }).toEqual({ x: 1000, y: 0 })
  })

  it("'rip-first' keeps a full-length rip: B goes into the strip below A", () => {
    const [, b] = guillotinePack(buildInput(parts, sheets, 0, 'rip-first')).packedSheets[0].placements
    expect({ x: b.x, y: b.y }).toEqual({ x: 0, y: 1000 })
  })

  it("'rip-first' rips along the long axis of a portrait sheet", () => {
    const { splitRipFirst } = __test
    const free = { x: 0, y: 0, w: 1220, h: 2440 }
    const [first] = splitRipFirst(free, { w: 1000, h: 1000, rotated: false }, 0, false)
    // Full-height child to the right: the rip runs along y.
    expect(first).toEqual({ x: 1000, y: 0, w: 220, h: 2440 })
  })
})

describe('guillotinePack — basic correctness', () => {
  it('places a single small part on one sheet', () => {
    const parts: Part[] = [
      {
        id: 'p1',
        label: 'A',
        materialId: MATERIAL.id,
        widthMm: 500,
        heightMm: 300,
        quantity: 1,
        grain: 'none',
        rotationLocked: false,
      },
    ]
    const sheets: Sheet[] = [
      {
        id: 's1',
        materialId: MATERIAL.id,
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 1,
        trimMm: 3.175,
      },
    ]
    const result = guillotinePack(buildInput(parts, sheets))
    expect(result.packedSheets).toHaveLength(1)
    expect(result.packedSheets[0].placements).toHaveLength(1)
    expect(result.unplacedPartIds).toHaveLength(0)
  })

  it('reports unplaced parts when a part is too large for any sheet', () => {
    const parts: Part[] = [
      {
        id: 'too-big',
        label: 'X',
        materialId: MATERIAL.id,
        widthMm: 5000,
        heightMm: 3000,
        quantity: 1,
        grain: 'none',
        rotationLocked: false,
      },
    ]
    const sheets: Sheet[] = [
      {
        id: 's1',
        materialId: MATERIAL.id,
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 1,
        trimMm: 3.175,
      },
    ]
    const result = guillotinePack(buildInput(parts, sheets))
    expect(result.unplacedPartIds).toContain('too-big')
  })

  it('honors grain=with: never rotates', () => {
    const parts: Part[] = [
      {
        id: 'p1',
        label: 'WithGrain',
        materialId: MATERIAL.id,
        widthMm: 1000,
        heightMm: 200,
        quantity: 1,
        grain: 'with',
        rotationLocked: false,
      },
    ]
    const sheets: Sheet[] = [
      {
        id: 's1',
        materialId: MATERIAL.id,
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 1,
        trimMm: 3.175,
      },
    ]
    const result = guillotinePack(buildInput(parts, sheets))
    expect(result.packedSheets[0].placements[0].rotated).toBe(false)
  })

  it('honors grain=across: always rotates', () => {
    const parts: Part[] = [
      {
        id: 'p1',
        label: 'Across',
        materialId: MATERIAL.id,
        widthMm: 1000,
        heightMm: 200,
        quantity: 1,
        grain: 'across',
        rotationLocked: false,
      },
    ]
    const sheets: Sheet[] = [
      {
        id: 's1',
        materialId: MATERIAL.id,
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 1,
        trimMm: 3.175,
      },
    ]
    const result = guillotinePack(buildInput(parts, sheets))
    expect(result.packedSheets[0].placements[0].rotated).toBe(true)
  })
})

describe('guillotinePack — property-based invariants', () => {
  const partArb = fc.record({
    widthMm: fc.integer({ min: 50, max: 800 }),
    heightMm: fc.integer({ min: 50, max: 600 }),
    quantity: fc.integer({ min: 1, max: 4 }),
    grain: fc.constantFrom('none', 'either', 'with', 'across') as fc.Arbitrary<
      Part['grain']
    >,
  })

  let runCounter = 0
  const inputArb = fc
    .array(partArb, { minLength: 1, maxLength: 8 })
    .map((rawParts) => {
      const idx = runCounter++
      const parts: Part[] = rawParts.map((p, i) => ({
        id: `p-${idx}-${i}`,
        label: `P${i}`,
        materialId: MATERIAL.id,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        quantity: p.quantity,
        grain: p.grain,
        rotationLocked: false,
      }))
      const sheets: Sheet[] = [
        {
          id: 's-' + idx,
          materialId: MATERIAL.id,
          widthMm: 2438.4,
          heightMm: 1219.2,
          quantity: 6,
          trimMm: 3.175,
        },
      ]
      return { parts, sheets, kerfMm: 3.175 }
    })
    .chain((base) =>
      fc
        .constantFrom<CutStrategy>('yield', 'rip-first')
        .map((cutStrategy) => ({ ...base, cutStrategy })),
    )

  it('every placed part fits within the trimmed sheet bounds', () => {
    fc.assert(
      fc.property(inputArb, ({ parts, sheets, kerfMm, cutStrategy }) => {
        const result = guillotinePack(buildInput(parts, sheets, kerfMm, cutStrategy))
        const sheet = sheets[0]
        const minX = sheet.trimMm
        const minY = sheet.trimMm
        const maxX = sheet.widthMm - sheet.trimMm
        const maxY = sheet.heightMm - sheet.trimMm
        for (const ps of result.packedSheets) {
          for (const pl of ps.placements) {
            const part = parts.find((p) => p.id === pl.partId)
            if (!part) throw new Error('placement references unknown part')
            const { w, h } = dimsFor(part, pl.rotated)
            expect(pl.x).toBeGreaterThanOrEqual(minX - 1e-6)
            expect(pl.y).toBeGreaterThanOrEqual(minY - 1e-6)
            expect(pl.x + w).toBeLessThanOrEqual(maxX + 1e-6)
            expect(pl.y + h).toBeLessThanOrEqual(maxY + 1e-6)
          }
        }
      }),
      { numRuns: 50 },
    )
  })

  it('no two placements overlap on the same packed sheet (kerf gap respected)', () => {
    fc.assert(
      fc.property(inputArb, ({ parts, sheets, kerfMm, cutStrategy }) => {
        const result = guillotinePack(buildInput(parts, sheets, kerfMm, cutStrategy))
        for (const ps of result.packedSheets) {
          const rects = ps.placements.map((pl) => {
            const part = parts.find((p) => p.id === pl.partId)!
            const { w, h } = dimsFor(part, pl.rotated)
            return { x: pl.x, y: pl.y, w, h }
          })
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const a = rects[i]
              const b = rects[j]
              // Two rectangles are kerf-separated if the gap between
              // them on at least one axis is >= kerfMm (or they don't
              // overlap on the perpendicular axis).
              const overlapsX =
                a.x < b.x + b.w + kerfMm - 1e-6 &&
                b.x < a.x + a.w + kerfMm - 1e-6
              const overlapsY =
                a.y < b.y + b.h + kerfMm - 1e-6 &&
                b.y < a.y + a.h + kerfMm - 1e-6
              const tooClose = overlapsX && overlapsY
              expect(tooClose).toBe(false)
            }
          }
        }
      }),
      { numRuns: 50 },
    )
  })

  it('grain=with parts are never rotated; grain=across parts are always rotated', () => {
    fc.assert(
      fc.property(inputArb, ({ parts, sheets, kerfMm, cutStrategy }) => {
        const result = guillotinePack(buildInput(parts, sheets, kerfMm, cutStrategy))
        for (const ps of result.packedSheets) {
          for (const pl of ps.placements) {
            const part = parts.find((p) => p.id === pl.partId)!
            if (part.grain === 'with') expect(pl.rotated).toBe(false)
            if (part.grain === 'across') expect(pl.rotated).toBe(true)
          }
        }
      }),
      { numRuns: 50 },
    )
  })

  it('utilization is between 0 and 1 inclusive', () => {
    fc.assert(
      fc.property(inputArb, ({ parts, sheets, kerfMm, cutStrategy }) => {
        const result = guillotinePack(buildInput(parts, sheets, kerfMm, cutStrategy))
        for (const ps of result.packedSheets) {
          expect(ps.utilization).toBeGreaterThanOrEqual(0)
          expect(ps.utilization).toBeLessThanOrEqual(1 + 1e-6)
        }
      }),
      { numRuns: 30 },
    )
  })
})

describe('guillotinePack — accounting', () => {
  it('every part instance is either placed exactly once or reported unplaced', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            widthMm: fc.integer({ min: 50, max: 2600 }),
            heightMm: fc.integer({ min: 50, max: 1300 }),
            quantity: fc.integer({ min: 1, max: 4 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.array(
          fc.record({
            widthMm: fc.integer({ min: 300, max: 2500 }),
            heightMm: fc.integer({ min: 300, max: 1300 }),
            quantity: fc.integer({ min: 1, max: 3 }),
          }),
          { minLength: 1, maxLength: 3 },
        ),
        fc.constantFrom<CutStrategy>('yield', 'rip-first'),
        (rawParts, rawSheets, cutStrategy) => {
          const parts: Part[] = rawParts.map((p, i) => ({
            ...p,
            id: `p${i}`,
            label: `P${i}`,
            materialId: MATERIAL.id,
            grain: 'none',
            rotationLocked: false,
          }))
          const sheets: Sheet[] = rawSheets.map((sh, i) => ({
            ...sh,
            id: `s${i}`,
            materialId: MATERIAL.id,
            trimMm: 0,
          }))
          const result = guillotinePack(buildInput(parts, sheets, 3.175, cutStrategy))
          for (const p of parts) {
            const placed = result.packedSheets
              .flatMap((ps) => ps.placements)
              .filter((pl) => pl.partId === p.id).length
            const unplaced = result.unplacedPartIds.filter((id) => id === p.id).length
            expect(placed + unplaced).toBe(p.quantity)
          }
          // copyIndex stays contiguous per sheet definition after elimination.
          for (const sh of sheets) {
            const idx = result.packedSheets
              .filter((ps) => ps.sheetId === sh.id)
              .map((ps) => ps.copyIndex)
            expect(idx).toEqual(idx.map((_, i) => i))
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
