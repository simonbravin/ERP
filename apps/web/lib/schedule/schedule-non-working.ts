import type { WorkingDayOptions } from './working-days'

const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * Normaliza fechas guardadas en DB (JSON) a lista única ordenada `YYYY-MM-DD`.
 */
export function parseNonWorkingDatesFromJson(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !YMD.test(item)) continue
    out.push(item)
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b))
}

export function workingDayOptionsFromStrings(
  dates: string[]
): WorkingDayOptions | undefined {
  if (dates.length === 0) return undefined
  return { nonWorkingDates: dates }
}

/**
 * Texto libre: una fecha por línea o separadas por coma/punto y coma.
 */
export function parseNonWorkingDatesFromUserInput(text: string): string[] {
  const parts = text
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parseNonWorkingDatesFromJson(parts)
}
