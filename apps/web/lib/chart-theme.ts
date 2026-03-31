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

/** Company cashflow lines: success / danger / warning + primary series for balance. */
export const chartFinanceLines = {
  income: 'hsl(var(--status-success))',
  expense: 'hsl(var(--status-danger))',
  overhead: 'hsl(var(--status-warning))',
  balance: 'hsl(var(--chart-1))',
} as const
