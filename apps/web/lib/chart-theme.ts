/**
 * Recharts / SVG colors that resolve against CSS variables in globals.css.
 * Emails and PDF HTML stay hardcoded; use this for in-app charts only.
 */

export const CHART_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const

export function chartSeriesColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]!
}

/** Default `fill` on `<Pie />` before `<Cell />` overrides (Recharts requires a value). */
export const CHART_PIE_PLACEHOLDER_FILL = 'hsl(var(--chart-1))'

export const chartAxis = {
  grid: 'hsl(var(--border))',
  tick: 'hsl(var(--muted-foreground))',
} as const

/** Finance line/area strokes — semantic chart tokens (not --status-*). */
export const chartFinanceLines = {
  income: 'hsl(var(--chart-income))',
  expense: 'hsl(var(--chart-expense))',
  overhead: 'hsl(var(--chart-neutral))',
  balance: 'hsl(var(--chart-balance))',
} as const

/**
 * Semantic tokens for ChartConfig / `var(--color-*)` (HSL triples in globals.css).
 */
export const chartSemanticHsl = {
  income: 'hsl(var(--chart-income))',
  expense: 'hsl(var(--chart-expense))',
  runningBalance: 'hsl(var(--chart-balance))',
} as const

export type PieSliceInput = { name: string; value: number }

/**
 * When category count exceeds `threshold`, collapse to top `topN` + Others for pie display only.
 * Does not alter source lists used by tables/API.
 */
export function groupPieSlicesForDisplay(
  items: PieSliceInput[],
  othersName: string,
  threshold = 6,
  topN = 5
): PieSliceInput[] {
  if (items.length <= threshold) {
    return items
  }
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, topN)
  const tail = sorted.slice(topN)
  const othersValue = tail.reduce((s, x) => s + x.value, 0)
  return [...head, { name: othersName, value: othersValue }]
}
