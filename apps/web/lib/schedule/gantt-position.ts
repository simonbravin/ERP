import { isSameDay } from 'date-fns'

/**
 * Index of the day in the visible days array (0-based), or -1 if the date is outside the range.
 */
export function getDayIndex(date: Date, days: Date[]): number {
  return days.findIndex((d) => isSameDay(d, date))
}

/**
 * X position in pixels for the start of the given date in the timeline.
 * Returns -1 if the date is not within the visible days range.
 */
export function getXFromDate(
  date: Date,
  days: Date[],
  dayWidth: number
): number {
  const idx = getDayIndex(date, days)
  if (idx === -1) return -1
  return idx * dayWidth
}

/**
 * Date at the given x position (start of the day cell). Clamps to the visible range.
 */
export function getDateFromX(
  x: number,
  days: Date[],
  dayWidth: number
): Date {
  if (days.length === 0) return new Date()
  const idx = Math.floor(x / dayWidth)
  const clamped = Math.max(0, Math.min(idx, days.length - 1))
  return days[clamped]
}
