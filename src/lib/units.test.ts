import { describe, it, expect } from 'vitest'
import { parseToMm, formatFromMm, MM_PER_INCH } from './units'
import { InvalidDimensionError } from '@/types'

describe('parseToMm', () => {
  it('parses whole + fraction inches', () => {
    expect(parseToMm('23 7/8', 'in')).toBeCloseTo(23.875 * MM_PER_INCH, 6)
  })

  it('parses whole + fraction with double-quote suffix', () => {
    expect(parseToMm('23 7/8"', 'in')).toBeCloseTo(23.875 * MM_PER_INCH, 6)
  })

  it('parses whole + fraction with hyphen separator', () => {
    expect(parseToMm('23-7/8', 'in')).toBeCloseTo(23.875 * MM_PER_INCH, 6)
  })

  it('parses fraction-only inches', () => {
    expect(parseToMm('1/2', 'in')).toBeCloseTo(0.5 * MM_PER_INCH, 6)
  })

  it('parses decimal inches when unit is in', () => {
    expect(parseToMm('23.875', 'in')).toBeCloseTo(23.875 * MM_PER_INCH, 6)
  })

  it('parses mm with suffix regardless of unit', () => {
    expect(parseToMm('607mm', 'in')).toBeCloseTo(607, 6)
    expect(parseToMm('607mm', 'mm')).toBeCloseTo(607, 6)
  })

  it('parses cm with suffix', () => {
    expect(parseToMm('60.7cm', 'in')).toBeCloseTo(607, 6)
  })

  it('parses m with suffix', () => {
    expect(parseToMm('1.2m', 'mm')).toBeCloseTo(1200, 6)
  })

  it('parses bare number using current unit (mm)', () => {
    expect(parseToMm('607', 'mm')).toBeCloseTo(607, 6)
  })

  it('parses bare number using current unit (in)', () => {
    expect(parseToMm('48', 'in')).toBeCloseTo(48 * MM_PER_INCH, 6)
  })

  it('parses inch literal suffix', () => {
    expect(parseToMm('48 in', 'mm')).toBeCloseTo(48 * MM_PER_INCH, 6)
    expect(parseToMm('48 inch', 'mm')).toBeCloseTo(48 * MM_PER_INCH, 6)
    expect(parseToMm('48 inches', 'mm')).toBeCloseTo(48 * MM_PER_INCH, 6)
  })

  it('parses zero', () => {
    expect(parseToMm('0', 'mm')).toBe(0)
    expect(parseToMm('0', 'in')).toBe(0)
  })

  it('parses 0.5 inches', () => {
    expect(parseToMm('0.5', 'in')).toBeCloseTo(12.7, 6)
  })

  it('parses 96 inches (8ft)', () => {
    expect(parseToMm('96', 'in')).toBeCloseTo(96 * MM_PER_INCH, 6)
  })

  it('throws on negative', () => {
    expect(() => parseToMm('-5', 'mm')).toThrow(InvalidDimensionError)
    expect(() => parseToMm('-1/2', 'in')).toThrow(InvalidDimensionError)
  })

  it('throws on empty', () => {
    expect(() => parseToMm('', 'mm')).toThrow(InvalidDimensionError)
    expect(() => parseToMm('   ', 'mm')).toThrow(InvalidDimensionError)
  })

  it('throws on garbage', () => {
    expect(() => parseToMm('abc', 'mm')).toThrow(InvalidDimensionError)
    expect(() => parseToMm('1/0', 'in')).toThrow(InvalidDimensionError)
  })
})

describe('formatFromMm', () => {
  it('formats mm with one decimal place', () => {
    expect(formatFromMm(607, 'mm')).toBe('607.0')
    expect(formatFromMm(2438.4, 'mm')).toBe('2438.4')
  })

  it('formats inches as nearest 1/32 by default', () => {
    expect(formatFromMm(23.875 * MM_PER_INCH, 'in')).toBe('23 7/8')
    expect(formatFromMm(0.5 * MM_PER_INCH, 'in')).toBe('1/2')
    expect(formatFromMm(MM_PER_INCH, 'in')).toBe('1')
  })

  it('formats inches with custom fraction base', () => {
    expect(formatFromMm(0.5 * MM_PER_INCH, 'in', 64)).toBe('1/2')
    expect(formatFromMm((1 / 64) * MM_PER_INCH, 'in', 64)).toBe('1/64')
  })

  it('reduces fractions', () => {
    expect(formatFromMm(0.25 * MM_PER_INCH, 'in', 32)).toBe('1/4')
    expect(formatFromMm(0.75 * MM_PER_INCH, 'in', 32)).toBe('3/4')
  })

  it('rounds up to next whole when fraction = base', () => {
    const justUnder = (1 - 1 / 1000) * MM_PER_INCH
    expect(formatFromMm(justUnder, 'in', 32)).toBe('1')
  })

  it('formats zero', () => {
    expect(formatFromMm(0, 'in')).toBe('0')
    expect(formatFromMm(0, 'mm')).toBe('0.0')
  })
})

describe('round-trip parse → format → parse', () => {
  const cases = ['23 7/8', '0.5', '48', '96', '1/2', '1/4', '3/4', '12 1/2']
  it.each(cases)('round-trips %s within tolerance (in)', (s) => {
    const mm1 = parseToMm(s, 'in')
    const formatted = formatFromMm(mm1, 'in', 64)
    const mm2 = parseToMm(formatted, 'in')
    expect(Math.abs(mm1 - mm2)).toBeLessThan(0.1)
  })

  it('round-trips mm values', () => {
    const mm1 = parseToMm('607', 'mm')
    const formatted = formatFromMm(mm1, 'mm')
    const mm2 = parseToMm(formatted, 'mm')
    expect(Math.abs(mm1 - mm2)).toBeLessThan(0.1)
  })
})
