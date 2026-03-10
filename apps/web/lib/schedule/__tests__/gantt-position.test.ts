import { describe, it, expect } from 'vitest'
import { getDayIndex, getXFromDate, getDateFromX } from '../gantt-position'
import { eachDayOfInterval } from 'date-fns'

describe('gantt-position', () => {
  const start = new Date(2025, 0, 1) // Jan 1
  const end = new Date(2025, 0, 10) // Jan 10
  const days = eachDayOfInterval({ start, end })
  const dayWidth = 100

  describe('getDayIndex', () => {
    it('returns index when date is in range', () => {
      expect(getDayIndex(new Date(2025, 0, 1), days)).toBe(0)
      expect(getDayIndex(new Date(2025, 0, 5), days)).toBe(4)
      expect(getDayIndex(new Date(2025, 0, 10), days)).toBe(9)
    })

    it('returns -1 when date is outside range', () => {
      expect(getDayIndex(new Date(2024, 11, 31), days)).toBe(-1)
      expect(getDayIndex(new Date(2025, 0, 11), days)).toBe(-1)
    })
  })

  describe('getXFromDate', () => {
    it('returns pixel position for date in range', () => {
      expect(getXFromDate(new Date(2025, 0, 1), days, dayWidth)).toBe(0)
      expect(getXFromDate(new Date(2025, 0, 5), days, dayWidth)).toBe(400)
      expect(getXFromDate(new Date(2025, 0, 10), days, dayWidth)).toBe(900)
    })

    it('returns -1 when date is outside range', () => {
      expect(getXFromDate(new Date(2025, 0, 15), days, dayWidth)).toBe(-1)
    })
  })

  describe('getDateFromX', () => {
    it('returns date at x position', () => {
      const d0 = getDateFromX(0, days, dayWidth)
      expect(d0.getFullYear()).toBe(2025)
      expect(d0.getMonth()).toBe(0)
      expect(d0.getDate()).toBe(1)

      const d5 = getDateFromX(450, days, dayWidth)
      expect(d5.getDate()).toBe(5)
    })

    it('clamps to first day when x is negative', () => {
      const d = getDateFromX(-100, days, dayWidth)
      expect(d.getDate()).toBe(1)
    })

    it('clamps to last day when x is past end', () => {
      const d = getDateFromX(9999, days, dayWidth)
      expect(d.getDate()).toBe(10)
    })

    it('returns a date when days array is empty', () => {
      const d = getDateFromX(0, [], dayWidth)
      expect(d).toBeInstanceOf(Date)
    })
  })
})
