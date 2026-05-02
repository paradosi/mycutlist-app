import { describe, it, expect } from 'vitest'
import {
  buildPreview,
  detectMapping,
  isMappingComplete,
  normalizeGrain,
  partsToCsv,
} from './csv'
import type { Material, Part } from '@/types'

const MATERIAL: Material = {
  id: 'mat-1',
  name: '3/4" Plywood',
  thicknessMm: 19.05,
  hasGrain: true,
}

describe('detectMapping', () => {
  it('matches common header variations', () => {
    const m = detectMapping(['Label', 'Length', 'Width', 'Qty', 'Material', 'Grain'])
    expect(m).toEqual({
      Label: 'label',
      Length: 'L',
      Width: 'W',
      Qty: 'qty',
      Material: 'material',
      Grain: 'grain',
    })
  })

  it('strips unit suffixes from headers', () => {
    const m = detectMapping(['L (in)', 'W (in)'])
    expect(m['L (in)']).toBe('L')
    expect(m['W (in)']).toBe('W')
  })

  it('handles alternate names', () => {
    const m = detectMapping(['Description', 'Long', 'Wide', 'Count'])
    expect(m).toEqual({
      Description: 'label',
      Long: 'L',
      Wide: 'W',
      Count: 'qty',
    })
  })

  it('returns skip for unrecognized headers', () => {
    const m = detectMapping(['Label', 'Notes', 'L', 'W'])
    expect(m['Notes']).toBe('skip')
  })

  it('does not double-assign a field', () => {
    const m = detectMapping(['Length', 'Long'])
    const fields = Object.values(m)
    const lCount = fields.filter((f) => f === 'L').length
    expect(lCount).toBe(1)
  })
})

describe('isMappingComplete', () => {
  it('passes when label, L, W are mapped', () => {
    expect(
      isMappingComplete({ Label: 'label', L: 'L', W: 'W' }),
    ).toBe(true)
  })

  it('fails when missing W', () => {
    expect(isMappingComplete({ Label: 'label', L: 'L' })).toBe(false)
  })
})

describe('normalizeGrain', () => {
  it.each([
    ['with', 'with'],
    ['With Grain', 'with'],
    ['parallel', 'with'],
    ['across', 'across'],
    ['Cross Grain', 'across'],
    ['perpendicular', 'across'],
    ['either', 'either'],
    ['both', 'either'],
    ['', 'none'],
    ['none', 'none'],
    ['random', 'none'],
  ])('normalizes "%s" → "%s"', (input, expected) => {
    expect(normalizeGrain(input)).toBe(expected)
  })
})

describe('buildPreview', () => {
  const baseRow = (overrides: Record<string, string>) => ({
    raw: {
      Label: 'Side',
      L: '24',
      W: '12',
      Qty: '2',
      Material: '3/4" Plywood',
      Grain: 'with',
      ...overrides,
    },
  })

  const mapping = {
    Label: 'label' as const,
    L: 'L' as const,
    W: 'W' as const,
    Qty: 'qty' as const,
    Material: 'material' as const,
    Grain: 'grain' as const,
  }

  it('parses a clean row', () => {
    const result = buildPreview({
      rows: [baseRow({})],
      mapping,
      materials: [MATERIAL],
      unit: 'in',
    })
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.label).toBe('Side')
    expect(row.widthMm).toBeCloseTo(24 * 25.4, 4)
    expect(row.heightMm).toBeCloseTo(12 * 25.4, 4)
    expect(row.quantity).toBe(2)
    expect(row.materialId).toBe(MATERIAL.id)
    expect(row.grain).toBe('with')
  })

  it('flags missing label', () => {
    const result = buildPreview({
      rows: [baseRow({ Label: '' })],
      mapping,
      materials: [MATERIAL],
      unit: 'in',
    })
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0].message).toMatch(/label/i)
  })

  it('flags zero/negative dimensions', () => {
    const result = buildPreview({
      rows: [baseRow({ L: '0' })],
      mapping,
      materials: [MATERIAL],
      unit: 'in',
    })
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0].message).toMatch(/> 0/)
  })

  it('marks unknown material name for creation', () => {
    const result = buildPreview({
      rows: [baseRow({ Material: '1/4" MDF' })],
      mapping,
      materials: [MATERIAL],
      unit: 'in',
    })
    expect(result.errors).toEqual([])
    expect(result.newMaterialNames).toContain('1/4" MDF')
    expect(result.rows[0].materialId).toBe('')
    expect(result.rows[0].materialName).toBe('1/4" MDF')
  })

  it('matches material by name case-insensitively', () => {
    const result = buildPreview({
      rows: [baseRow({ Material: '3/4" plywood' })],
      mapping,
      materials: [MATERIAL],
      unit: 'in',
    })
    expect(result.rows[0].materialId).toBe(MATERIAL.id)
    expect(result.newMaterialNames).toEqual([])
  })

  it('defaults qty to 1 when missing or invalid', () => {
    const result = buildPreview({
      rows: [baseRow({ Qty: '' }), baseRow({ Qty: 'abc' })],
      mapping,
      materials: [MATERIAL],
      unit: 'in',
    })
    expect(result.rows[0].quantity).toBe(1)
    expect(result.rows[1].quantity).toBe(1)
  })

  it('clamps qty to 999', () => {
    const result = buildPreview({
      rows: [baseRow({ Qty: '5000' })],
      mapping,
      materials: [MATERIAL],
      unit: 'in',
    })
    expect(result.rows[0].quantity).toBe(999)
  })
})

describe('partsToCsv', () => {
  it('renders header and rows in project unit', () => {
    const parts: Part[] = [
      {
        id: 'p1',
        label: 'Side',
        materialId: MATERIAL.id,
        widthMm: 24 * 25.4,
        heightMm: 12 * 25.4,
        quantity: 2,
        grain: 'with',
        rotationLocked: false,
      },
    ]
    const csv = partsToCsv({ parts, materials: [MATERIAL], unit: 'in' })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Label,L (in),W (in),Qty,Material,Grain')
    expect(lines[1]).toContain('Side')
    expect(lines[1]).toContain('24')
    expect(lines[1]).toContain('12')
    expect(lines[1]).toContain('with')
  })

  it('escapes commas, quotes, and newlines', () => {
    const parts: Part[] = [
      {
        id: 'p1',
        label: 'Side, "front"',
        materialId: MATERIAL.id,
        widthMm: 100,
        heightMm: 100,
        quantity: 1,
        grain: 'none',
        rotationLocked: false,
      },
    ]
    const csv = partsToCsv({ parts, materials: [MATERIAL], unit: 'mm' })
    expect(csv).toContain('"Side, ""front"""')
  })
})
