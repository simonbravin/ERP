import { describe, it, expect } from 'vitest'
import {
  isWorkingDay,
  addWorkingDays,
  countWorkingDays,
  getNextWorkingDay,
  getPreviousWorkingDay,
} from '../working-days'

describe('working-days', () => {
  const fiveDays = 5
  const sixDays = 6
  const sevenDays = 7

  describe('isWorkingDay', () => {
    it('with 7 days per week, every day is working', () => {
      const mon = new Date(2025, 0, 6)
      const sun = new Date(2025, 0, 5)
      expect(isWorkingDay(mon, sevenDays)).toBe(true)
      expect(isWorkingDay(sun, sevenDays)).toBe(true)
    })

    it('with 5 days per week, Saturday and Sunday are not working', () => {
      const sat = new Date(2025, 0, 4) // Saturday
      const sun = new Date(2025, 0, 5) // Sunday
      const mon = new Date(2025, 0, 6) // Monday
      expect(isWorkingDay(sat, fiveDays)).toBe(false)
      expect(isWorkingDay(sun, fiveDays)).toBe(false)
      expect(isWorkingDay(mon, fiveDays)).toBe(true)
    })

    it('with 6 days per week, only Sunday is non-working', () => {
      const sat = new Date(2025, 0, 4)
      const sun = new Date(2025, 0, 5)
      expect(isWorkingDay(sat, sixDays)).toBe(true)
      expect(isWorkingDay(sun, sixDays)).toBe(false)
    })

    it('respects explicit non-working exception dates', () => {
      const mon = new Date(2025, 0, 6)
      expect(
        isWorkingDay(mon, sevenDays, { nonWorkingDates: ['2025-01-06'] })
      ).toBe(false)
    })
  })

  describe('addWorkingDays', () => {
    it('adds zero returns same date', () => {
      const d = new Date(2025, 0, 6)
      const r = addWorkingDays(d, 0, fiveDays)
      expect(r.getTime()).toBe(d.getTime())
    })

    it('adds 1 working day moves to next working day', () => {
      const mon = new Date(2025, 0, 6) // Monday
      const tue = addWorkingDays(mon, 1, fiveDays)
      expect(tue.getDate()).toBe(7)
    })

    it('adding 3 from Friday skips weekend', () => {
      const fri = new Date(2025, 0, 10) // Friday Jan 10
      const r = addWorkingDays(fri, 3, fiveDays) // Mon, Tue, Wed
      expect(r.getDate()).toBe(15)
      expect(r.getDay()).toBe(3) // Wednesday
    })

    it('subtracts working days', () => {
      const wed = new Date(2025, 0, 15)
      const r = addWorkingDays(wed, -3, fiveDays)
      expect(r.getDate()).toBe(10)
      expect(r.getDay()).toBe(5) // Friday
    })

    it('skips custom non-working days when adding', () => {
      const mon = new Date(2025, 0, 6)
      const r = addWorkingDays(mon, 2, sevenDays, {
        nonWorkingDates: ['2025-01-07'],
      })
      expect(r.getDate()).toBe(9)
    })
  })

  describe('countWorkingDays', () => {
    it('same day returns 1', () => {
      const d = new Date(2025, 0, 6)
      expect(countWorkingDays(d, d, fiveDays)).toBe(1)
    })

    it('Monday to Friday same week returns 5', () => {
      const mon = new Date(2025, 0, 6)
      const fri = new Date(2025, 0, 10)
      expect(countWorkingDays(mon, fri, fiveDays)).toBe(5)
    })

    it('Friday to Monday next week returns 2 (Fri-Mon span, 2 working days)', () => {
      const fri = new Date(2025, 0, 10)
      const mon = new Date(2025, 0, 13)
      expect(countWorkingDays(fri, mon, fiveDays)).toBe(2)
    })

    it('reversed dates return negative count', () => {
      const mon = new Date(2025, 0, 6)
      const fri = new Date(2025, 0, 10)
      expect(countWorkingDays(fri, mon, fiveDays)).toBe(-5)
    })

    it('excludes custom non-working days from count', () => {
      const mon = new Date(2025, 0, 6)
      const fri = new Date(2025, 0, 10)
      const count = countWorkingDays(mon, fri, fiveDays, {
        nonWorkingDates: ['2025-01-08'],
      })
      expect(count).toBe(4)
    })
  })

  describe('getNextWorkingDay', () => {
    it('from Friday returns Monday', () => {
      const fri = new Date(2025, 0, 10)
      const next = getNextWorkingDay(fri, fiveDays)
      expect(next.getDay()).toBe(1)
      expect(next.getDate()).toBe(13)
    })

    it('skips explicit non-working date', () => {
      const mon = new Date(2025, 0, 6)
      const next = getNextWorkingDay(mon, sevenDays, {
        nonWorkingDates: ['2025-01-07'],
      })
      expect(next.getDate()).toBe(8)
    })
  })

  describe('getPreviousWorkingDay', () => {
    it('from Monday returns Friday', () => {
      const mon = new Date(2025, 0, 13)
      const prev = getPreviousWorkingDay(mon, fiveDays)
      expect(prev.getDay()).toBe(5)
      expect(prev.getDate()).toBe(10)
    })

    it('skips explicit non-working date backwards', () => {
      const thu = new Date(2025, 0, 9)
      const prev = getPreviousWorkingDay(thu, sevenDays, {
        nonWorkingDates: ['2025-01-08'],
      })
      expect(prev.getDate()).toBe(7)
    })
  })
})
