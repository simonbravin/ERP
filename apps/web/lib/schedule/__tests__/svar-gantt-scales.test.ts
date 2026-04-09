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
  it('day zoom: month row + short day number on second scale (avoids label overlap)', () => {
    const scales = buildSvarScalesForBloqerZoom('day', 1, es)
    expect(scales).toHaveLength(2)
    expect(scales[0].unit).toBe('month')
    expect(scales[1].unit).toBe('day')
    const monthFmt = scales[0].format as (d: Date) => string
    expect(monthFmt(new Date(2025, 0, 8))).toMatch(/enero|January/i)
    const dayFmt = scales[1].format as (d: Date, n?: Date) => string
    expect(dayFmt(new Date(2025, 0, 8), undefined)).toBe('8')
  })

  it('week zoom: same two-row pattern with numeric day labels', () => {
    const scales = buildSvarScalesForBloqerZoom('week', 1, es)
    expect(scales).toHaveLength(2)
    const fmt = scales[1].format as (d: Date, n?: Date) => string
    expect(fmt(new Date(2025, 0, 6), undefined)).toBe('6')
    expect(fmt(new Date(2025, 0, 7), undefined)).toBe('7')
  })
})

describe('svarCellWidthForZoom', () => {
  it('narrows cells for month zoom', () => {
    expect(svarCellWidthForZoom('day')).toBeGreaterThan(svarCellWidthForZoom('month'))
  })
})
