import { startOfDay } from 'date-fns'

/** Parse `yyyy-MM-dd` como día calendario local (evita corrimiento UTC de `new Date('yyyy-MM-dd')`). */
export function parseLocalYmd(ymd: string): Date {
  const parts = ymd.split('-').map((x) => parseInt(x, 10))
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return startOfDay(new Date())
  return startOfDay(new Date(y, m - 1, d))
}
