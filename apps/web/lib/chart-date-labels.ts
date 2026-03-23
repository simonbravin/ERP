/**
 * Deterministic Spanish month labels from "YYYY-MM" (chart axes, tooltips).
 * Avoids Intl SSR/client ICU differences (React hydration #418).
 */
const ES_MONTH_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

const ES_MONTH_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

function parseYearMonth(ym: string): { year: string; month: number } | null {
  const parts = ym.split('-')
  const year = parts[0]
  const mo = parts[1]
  if (!year || !mo) return null
  const month = Number.parseInt(mo, 10)
  if (!Number.isFinite(month) || month < 1 || month > 12) return null
  return { year, month }
}

export function chartMonthShortEs(ym: string): string {
  const p = parseYearMonth(ym)
  if (!p) return '—'
  return ES_MONTH_SHORT[p.month - 1]
}

/** e.g. "mar 24" — matches prior chart axis style */
export function chartMonthYearShortEs(ym: string): string {
  const p = parseYearMonth(ym)
  if (!p) return '—'
  const yy = p.year.length >= 2 ? p.year.slice(-2) : p.year
  return `${ES_MONTH_SHORT[p.month - 1]} ${yy}`
}

/** e.g. "marzo 2024" */
export function chartMonthLongYearEs(ym: string): string {
  const p = parseYearMonth(ym)
  if (!p) return '—'
  return `${ES_MONTH_LONG[p.month - 1]} ${p.year}`
}
