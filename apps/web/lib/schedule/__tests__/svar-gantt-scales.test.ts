import { describe, expect, it } from 'vitest'
import { es } from 'date-fns/locale'
import {
  parseSchedulePlanDate,
  buildSvarScalesForBloqerZoom,
  svarCellWidthForZoom,
} from '../svar-gantt-scales'

describe('parseSchedulePlanDate', () => {
  it('parses YYYY-MM-DD prefix as local calendar date (noon)', () => {
    const d = parseSchedulePlanDate('2025-06-15T00:00:00.000Z')
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(12)
  })
})

describe('buildSvarScalesForBloqerZoom', () => {
  it('day zoom uses dd/MM/yyyy on second scale', () => {
    const scales = buildSvarScalesForBloqerZoom('day', 1, es)
    expect(scales).toHaveLength(2)
    expect(scales[1].unit).toBe('day')
    const fmt = scales[1].format
    expect(typeof fmt).toBe('function')
    const label = (fmt as (d: Date, n?: Date) => string)(
      new Date(2025, 0, 8),
      undefined
    )
    expect(label).toMatch(/08\/01\/2025/)
  })

  it('week zoom labels week start only (Monday)', () => {
    const scales = buildSvarScalesForBloqerZoom('week', 1, es)
    const fmt = scales[1].format as (d: Date, n?: Date) => string
    // 2025-01-06 is Monday
    expect(fmt(new Date(2025, 0, 6), undefined)).toMatch(/06\/01\/2025/)
    expect(fmt(new Date(2025, 0, 7), undefined)).toBe('')
  })
})

describe('svarCellWidthForZoom', () => {
  it('narrows cells for month zoom', () => {
    expect(svarCellWidthForZoom('day')).toBeGreaterThan(svarCellWidthForZoom('month'))
  })
})
