import type { Grain, Material, Part, Unit } from '@/types'
import { InvalidDimensionError } from '@/types'
import { formatFromMm, parseToMm } from '@/lib/units'

export type FieldKey = 'label' | 'L' | 'W' | 'qty' | 'material' | 'grain' | 'skip'

const HEADER_ALIASES: Record<Exclude<FieldKey, 'skip'>, string[]> = {
  label: ['label', 'name', 'part', 'partname', 'description', 'desc', 'item'],
  L: ['l', 'length', 'long', 'len', 'lengthmm', 'lengthin'],
  W: ['w', 'width', 'wide', 'wid', 'widthmm', 'widthin'],
  qty: ['qty', 'quantity', 'count', 'num', 'number', 'pieces', 'pcs'],
  material: ['material', 'mat', 'stock', 'stocktype'],
  grain: ['grain', 'graindirection', 'direction'],
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // strip "(in)", "(mm)" etc.
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

export function detectMapping(headers: string[]): Record<string, FieldKey> {
  const result: Record<string, FieldKey> = {}
  const used = new Set<FieldKey>()
  for (const h of headers) {
    const norm = normalizeHeader(h)
    let matched: FieldKey = 'skip'
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      Exclude<FieldKey, 'skip'>,
      string[],
    ][]) {
      if (used.has(field)) continue
      if (aliases.includes(norm)) {
        matched = field
        break
      }
    }
    result[h] = matched
    if (matched !== 'skip') used.add(matched)
  }
  return result
}

const REQUIRED_FIELDS: FieldKey[] = ['label', 'L', 'W']

export function isMappingComplete(mapping: Record<string, FieldKey>): boolean {
  const present = new Set(Object.values(mapping))
  return REQUIRED_FIELDS.every((f) => present.has(f))
}

export function normalizeGrain(raw: string): Grain {
  const v = raw.toLowerCase().trim()
  if (!v) return 'none'
  if (['with', 'with grain', 'withgrain', 'y', 'yes', 'parallel'].includes(v))
    return 'with'
  if (
    [
      'across',
      'across grain',
      'cross grain',
      'crossgrain',
      'perpendicular',
      'cross',
    ].includes(v)
  )
    return 'across'
  if (['either', 'both', 'any'].includes(v)) return 'either'
  return 'none'
}

export interface PreviewRow {
  label: string
  widthMm: number
  heightMm: number
  quantity: number
  materialName: string
  materialId: string
  grain: Grain
  warnings: string[]
}

export interface ParsedRow {
  raw: Record<string, string>
}

export interface PreviewResult {
  rows: PreviewRow[]
  errors: { row: number; message: string }[]
  newMaterialNames: string[]
}

interface BuildPreviewOpts {
  rows: ParsedRow[]
  mapping: Record<string, FieldKey>
  materials: Material[]
  unit: Unit
}

export function buildPreview({
  rows,
  mapping,
  materials,
  unit,
}: BuildPreviewOpts): PreviewResult {
  const fieldToHeader = invertMapping(mapping)
  const out: PreviewRow[] = []
  const errors: { row: number; message: string }[] = []
  const newMaterialNames = new Set<string>()
  const knownByName = new Map(
    materials.map((m) => [m.name.trim().toLowerCase(), m]),
  )
  const fallbackMaterial = materials[0]

  rows.forEach((r, i) => {
    const get = (f: FieldKey): string => {
      const header = fieldToHeader[f]
      if (!header) return ''
      const v = r.raw[header]
      return v == null ? '' : String(v).trim()
    }

    const label = get('label')
    if (!label) {
      errors.push({ row: i + 1, message: 'Missing label' })
      return
    }

    let widthMm: number
    let heightMm: number
    try {
      widthMm = parseToMm(get('L'), unit)
      heightMm = parseToMm(get('W'), unit)
    } catch (e) {
      errors.push({
        row: i + 1,
        message:
          e instanceof InvalidDimensionError ? e.message : 'Bad dimension',
      })
      return
    }
    if (widthMm <= 0 || heightMm <= 0) {
      errors.push({ row: i + 1, message: 'Dimensions must be > 0' })
      return
    }

    const qtyRaw = get('qty')
    let quantity = qtyRaw === '' ? 1 : Number(qtyRaw)
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1
    quantity = Math.min(999, Math.floor(quantity))

    const grainRaw = get('grain')
    const grain = normalizeGrain(grainRaw)

    const matRaw = get('material')
    const warnings: string[] = []
    let materialId = ''
    let materialName = ''
    if (matRaw) {
      const found = knownByName.get(matRaw.toLowerCase())
      if (found) {
        materialId = found.id
        materialName = found.name
      } else {
        // Will be created on commit; mark for caller.
        materialId = ''
        materialName = matRaw
        newMaterialNames.add(matRaw)
        warnings.push(`new material "${matRaw}" will be created`)
      }
    } else if (fallbackMaterial) {
      materialId = fallbackMaterial.id
      materialName = fallbackMaterial.name
      warnings.push(`no material in CSV — defaulting to ${fallbackMaterial.name}`)
    } else {
      errors.push({ row: i + 1, message: 'No material specified and no default available' })
      return
    }

    out.push({
      label,
      widthMm,
      heightMm,
      quantity,
      materialName,
      materialId,
      grain,
      warnings,
    })
  })

  return {
    rows: out,
    errors,
    newMaterialNames: Array.from(newMaterialNames),
  }
}

function invertMapping(
  mapping: Record<string, FieldKey>,
): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {}
  for (const [header, field] of Object.entries(mapping)) {
    if (field !== 'skip' && !out[field]) out[field] = header
  }
  return out
}

// CSV export ---------------------------------------------------------------

export interface ExportOpts {
  parts: Part[]
  materials: Material[]
  unit: Unit
}

export function partsToCsv({ parts, materials, unit }: ExportOpts): string {
  const headers = [
    'Label',
    `L (${unit})`,
    `W (${unit})`,
    'Qty',
    'Material',
    'Grain',
  ]
  const lines = [headers.map(csvEscape).join(',')]
  for (const p of parts) {
    const mat = materials.find((m) => m.id === p.materialId)
    lines.push(
      [
        csvEscape(p.label),
        csvEscape(formatFromMm(p.widthMm, unit)),
        csvEscape(formatFromMm(p.heightMm, unit)),
        csvEscape(String(p.quantity)),
        csvEscape(mat?.name ?? ''),
        csvEscape(p.grain),
      ].join(','),
    )
  }
  return lines.join('\n')
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
