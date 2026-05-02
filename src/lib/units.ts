import { InvalidDimensionError, type Unit } from '@/types'

export const MM_PER_INCH = 25.4
const MM2_PER_FT2 = 92903.04 // 12 in × 25.4 mm/in squared
const MM2_PER_M2 = 1_000_000

export function formatAreaFromMm2(mm2: number, unit: Unit): string {
  if (!Number.isFinite(mm2) || mm2 < 0) return '0'
  if (unit === 'in') {
    return `${(mm2 / MM2_PER_FT2).toFixed(2)} ft²`
  }
  return `${(mm2 / MM2_PER_M2).toFixed(2)} m²`
}

const NUMBER = String.raw`-?\d+(?:\.\d+)?`
const FRACTION = String.raw`\d+\s*\/\s*\d+`

const SUFFIX_MM = /^\s*(-?\d+(?:\.\d+)?)\s*mm\s*$/i
const SUFFIX_CM = /^\s*(-?\d+(?:\.\d+)?)\s*cm\s*$/i
const SUFFIX_M = /^\s*(-?\d+(?:\.\d+)?)\s*m\s*$/i
const SUFFIX_IN_DOUBLE = /"$/
const SUFFIX_IN_PRIME = /['']$/
const SUFFIX_IN_LITERAL = /\bin(?:ch(?:es)?)?\.?\s*$/i

const FRACTION_ONLY = new RegExp(`^\\s*(-?)\\s*(${FRACTION})\\s*$`)
const WHOLE_PLUS_FRACTION = new RegExp(
  `^\\s*(-?)\\s*(\\d+)[\\s-]+(${FRACTION})\\s*$`,
)
const DECIMAL_ONLY = new RegExp(`^\\s*(${NUMBER})\\s*$`)

function parseFraction(numerator: string, denominator: string): number {
  const n = Number(numerator)
  const d = Number(denominator)
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) {
    throw new InvalidDimensionError(`${numerator}/${denominator}`, 'bad fraction')
  }
  return n / d
}

function stripImperialSuffix(s: string): { stripped: string; isInch: boolean } {
  let stripped = s.trim()
  let isInch = false
  if (SUFFIX_IN_DOUBLE.test(stripped)) {
    stripped = stripped.replace(SUFFIX_IN_DOUBLE, '').trim()
    isInch = true
  } else if (SUFFIX_IN_PRIME.test(stripped)) {
    stripped = stripped.replace(SUFFIX_IN_PRIME, '').trim()
    isInch = true
  } else if (SUFFIX_IN_LITERAL.test(stripped)) {
    stripped = stripped.replace(SUFFIX_IN_LITERAL, '').trim()
    isInch = true
  }
  return { stripped, isInch }
}

function toInches(input: string): number | null {
  const { stripped } = stripImperialSuffix(input)

  const wf = WHOLE_PLUS_FRACTION.exec(stripped)
  if (wf) {
    const sign = wf[1] === '-' ? -1 : 1
    const whole = Number(wf[2])
    const [num, den] = wf[3].split('/').map((x) => x.trim())
    return sign * (whole + parseFraction(num, den))
  }

  const f = FRACTION_ONLY.exec(stripped)
  if (f) {
    const sign = f[1] === '-' ? -1 : 1
    const [num, den] = f[2].split('/').map((x) => x.trim())
    return sign * parseFraction(num, den)
  }

  const d = DECIMAL_ONLY.exec(stripped)
  if (d) {
    const v = Number(d[1])
    if (!Number.isFinite(v)) return null
    return v
  }

  return null
}

export function parseToMm(input: string, unit: Unit): number {
  if (typeof input !== 'string') {
    throw new InvalidDimensionError(String(input), 'not a string')
  }
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    throw new InvalidDimensionError(input, 'empty')
  }

  const mm = SUFFIX_MM.exec(trimmed)
  if (mm) {
    const v = Number(mm[1])
    return validate(v, input)
  }
  const cm = SUFFIX_CM.exec(trimmed)
  if (cm) {
    const v = Number(cm[1])
    return validate(v * 10, input)
  }
  const m = SUFFIX_M.exec(trimmed)
  if (m) {
    const v = Number(m[1])
    return validate(v * 1000, input)
  }

  const { isInch } = stripImperialSuffix(trimmed)
  const inches = toInches(trimmed)
  if (inches === null) {
    throw new InvalidDimensionError(input, 'unparseable')
  }

  const treatAsInch = isInch || unit === 'in'
  const mmValue = treatAsInch ? inches * MM_PER_INCH : inches
  return validate(mmValue, input)
}

function validate(mm: number, original: string): number {
  if (!Number.isFinite(mm)) {
    throw new InvalidDimensionError(original, 'not finite')
  }
  if (mm < 0) {
    throw new InvalidDimensionError(original, 'negative not allowed')
  }
  return mm
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function reduceFraction(num: number, den: number): { num: number; den: number } {
  if (num === 0) return { num: 0, den: 1 }
  const g = gcd(Math.abs(num), Math.abs(den))
  return { num: num / g, den: den / g }
}

export function formatFromMm(
  mm: number,
  unit: Unit,
  fractionBase: 64 | 32 | 16 | 8 = 32,
): string {
  if (!Number.isFinite(mm)) {
    throw new InvalidDimensionError(String(mm), 'not finite')
  }
  if (unit === 'mm') {
    return mm.toFixed(1)
  }

  const inches = mm / MM_PER_INCH
  const sign = inches < 0 ? '-' : ''
  const absIn = Math.abs(inches)
  const whole = Math.floor(absIn)
  const remainder = absIn - whole
  const numer = Math.round(remainder * fractionBase)

  if (numer === 0) {
    return `${sign}${whole}`
  }
  if (numer === fractionBase) {
    return `${sign}${whole + 1}`
  }
  const reduced = reduceFraction(numer, fractionBase)
  if (whole === 0) {
    return `${sign}${reduced.num}/${reduced.den}`
  }
  return `${sign}${whole} ${reduced.num}/${reduced.den}`
}
