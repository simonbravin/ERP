'use client'

import * as React from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { useChartSeriesInteraction } from '@/hooks/use-chart-series-interaction'
import { cn } from '@/lib/utils'
import { formatChartAxisCurrency } from '@/lib/chart-format'
import { formatCurrency } from '@/lib/format-utils'
import { chartSemanticHsl } from '@/lib/chart-theme'
import { createLastPointDot } from '@/components/charts/chart-line-style'

export type CashflowTimelineDatum = {
  monthLabel: string
  income: number
  expense: number
  balance: number
  periodNet: number
}

export type CashflowTimelineTooltipLabels = {
  income: string
  expenses: string
  runningBalance: string
  periodNet: string
  vsPrevious: string
  /** Leyenda del modo solo neto (barras positivas / negativas). */
  periodNetLegendPositive?: string
  periodNetLegendNegative?: string
}

/**
 * `lines`: área + líneas suaves en un eje.
 * `bars`: ingresos/gastos en barras (eje izq.) y balance en área (eje der.).
 * `periodNet`: solo neto del período (ingresos − gastos), barras verdes / rojas desde el eje 0.
 */
export type CashflowTimelineSeriesStyle = 'lines' | 'bars' | 'periodNet'

const CHART_MARGIN = { top: 18, right: 20, left: 4, bottom: 8 } as const

type CashflowTimelineTooltipProps = Partial<
  TooltipContentProps<number, string>
> & {
  chartData: CashflowTimelineDatum[]
  formatMoney: (n: number) => string
  labels: CashflowTimelineTooltipLabels
  colors: { income: string; expense: string; balance: string }
  seriesStyle: CashflowTimelineSeriesStyle
}

function CashflowTimelineTooltip({
  active,
  label,
  payload,
  chartData,
  formatMoney,
  labels,
  colors,
  seriesStyle,
}: CashflowTimelineTooltipProps) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload as CashflowTimelineDatum | undefined
  if (!row) return null

  const idx = chartData.findIndex((d) => d.monthLabel === label)
  const prev = idx > 0 ? chartData[idx - 1] : null
  const delta = prev !== null ? row.periodNet - prev.periodNet : null

  if (seriesStyle === 'periodNet') {
    return (
      <div className="animate-in fade-in-0 zoom-in-95 z-50 min-w-[200px] rounded-lg border border-border/60 bg-background px-3 py-2.5 text-xs shadow-md">
        <p className="mb-2 font-medium text-foreground">{label}</p>
        <div className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            {labels.periodNet}
          </p>
          <p
            className={cn(
              'mt-0.5 font-mono text-base font-semibold tabular-nums tracking-tight',
              row.periodNet >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            {formatMoney(row.periodNet)}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/50 pt-2">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: colors.balance }}
              aria-hidden
            />
            {labels.runningBalance}
          </span>
          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
            {formatMoney(row.balance)}
          </span>
        </div>
        {delta !== null && Number.isFinite(delta) ? (
          <p className="mt-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            {labels.vsPrevious}:{' '}
            <span
              className={cn(
                'font-medium tabular-nums',
                delta >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {delta >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(delta))}
            </span>
          </p>
        ) : null}
      </div>
    )
  }

  const rows: { key: string; label: string; value: string; color: string }[] = [
    {
      key: 'income',
      label: labels.income,
      value: formatMoney(row.income),
      color: colors.income,
    },
    {
      key: 'expense',
      label: labels.expenses,
      value: formatMoney(row.expense),
      color: colors.expense,
    },
    {
      key: 'periodNet',
      label: labels.periodNet,
      value: formatMoney(row.periodNet),
      color: colors.balance,
    },
    {
      key: 'balance',
      label: labels.runningBalance,
      value: formatMoney(row.balance),
      color: colors.balance,
    },
  ]

  return (
    <div className="animate-in fade-in-0 zoom-in-95 z-50 min-w-[220px] rounded-lg border border-border/60 bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-2 font-medium text-foreground">{label}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: r.color }}
                aria-hidden
              />
              {r.label}
            </span>
            <span className="font-mono text-xs font-medium tabular-nums text-foreground">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
      {delta !== null && Number.isFinite(delta) ? (
        <p className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          {labels.vsPrevious}:{' '}
          <span
            className={cn(
              'font-medium tabular-nums',
              delta >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            {delta >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(delta))}
          </span>
        </p>
      ) : null}
    </div>
  )
}

export type CashflowTimelineComposedChartProps = {
  data: CashflowTimelineDatum[]
  config: ChartConfig
  /** Pass range / tab value so Recharts remounts with a short animation. */
  animationKey?: string
  className?: string
  currency?: string
  locale?: string
  tooltipLabels: CashflowTimelineTooltipLabels
  seriesStyle?: CashflowTimelineSeriesStyle
}

export function CashflowTimelineComposedChart({
  data,
  config,
  animationKey,
  className = 'min-h-[280px] w-full',
  currency = 'ARS',
  locale = 'es-AR',
  tooltipLabels,
  seriesStyle = 'lines',
}: CashflowTimelineComposedChartProps) {
  const formatMoney = React.useCallback(
    (n: number) => formatCurrency(n, currency, locale),
    [currency, locale]
  )

  const axisFormatter = React.useCallback(
    (v: number) => formatChartAxisCurrency(v, { locale, currency }),
    [locale, currency]
  )

  const tooltipColors = React.useMemo(
    () => ({
      income: chartSemanticHsl.income,
      expense: chartSemanticHsl.expense,
      balance: chartSemanticHsl.runningBalance,
    }),
    []
  )

  const tooltipRenderer = React.useCallback(
    (props: Partial<TooltipContentProps<number, string>>) => (
      <CashflowTimelineTooltip
        {...props}
        chartData={data}
        formatMoney={formatMoney}
        labels={tooltipLabels}
        colors={tooltipColors}
        seriesStyle={seriesStyle}
      />
    ),
    [data, formatMoney, tooltipLabels, tooltipColors, seriesStyle]
  )

  const periodNetYDomain = React.useMemo((): [number, number] | undefined => {
    if (!data.length) return undefined
    const vals = data.map((d) => d.periodNet)
    const minV = Math.min(0, ...vals)
    const maxV = Math.max(0, ...vals)
    const span = maxV - minV || 1
    const pad = span * 0.06
    return [minV - pad, maxV + pad]
  }, [data])

  const periodNetLegendPositive =
    tooltipLabels.periodNetLegendPositive ?? 'Net ≥ 0'
  const periodNetLegendNegative =
    tooltipLabels.periodNetLegendNegative ?? 'Net < 0'

  const {
    hiddenKeys,
    setHoverKey,
    toggleKey,
    linePresentation,
    areaPresentation,
    barPresentation,
  } = useChartSeriesInteraction()

  const balanceArea = areaPresentation('balance', 3, 0.18)
  const incomeLine = linePresentation('income', 2.3)
  const expenseLine = linePresentation('expense', 2.3)
  const incomeBar = barPresentation('income')
  const expenseBar = barPresentation('expense')
  const dotRenderer = React.useMemo(() => createLastPointDot(data.length), [data.length])
  const gradientPrefix = React.useId().replace(/:/g, '')

  const curve = 'monotone' as const
  const lineStrokeProps = {
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const yAxisShared = {
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    width: 58,
    tick: { fontSize: 12 },
    tickFormatter: axisFormatter,
  }

  return (
    <ChartContainer key={animationKey} config={config} className={className}>
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={CHART_MARGIN}
        onMouseLeave={() => setHoverKey(null)}
      >
        <defs>
          <linearGradient id={`${gradientPrefix}-income-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.34} />
            <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id={`${gradientPrefix}-expense-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-expense)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-expense)" stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id={`${gradientPrefix}-balance-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="hsl(var(--border))"
          strokeOpacity={0.45}
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey="monthLabel"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={{ fontSize: 12 }}
          minTickGap={24}
        />
        {seriesStyle === 'bars' ? (
          <>
            <YAxis yAxisId="flow" {...yAxisShared} />
            <YAxis yAxisId="bal" orientation="right" {...yAxisShared} />
          </>
        ) : (
          <YAxis
            {...yAxisShared}
            {...(seriesStyle === 'periodNet' && periodNetYDomain
              ? { domain: periodNetYDomain }
              : {})}
          />
        )}
        <ChartTooltip
          isAnimationActive={false}
          cursor={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.55 }}
          content={tooltipRenderer}
        />
        {seriesStyle === 'periodNet' ? (
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: 12 }}
            content={() => (
              <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: chartSemanticHsl.income }}
                    aria-hidden
                  />
                  {periodNetLegendPositive}
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: chartSemanticHsl.expense }}
                    aria-hidden
                  />
                  {periodNetLegendNegative}
                </li>
              </ul>
            )}
          />
        ) : (
          <ChartLegend
            verticalAlign="bottom"
            content={
              <ChartLegendContent
                className="pt-4"
                hiddenKeys={hiddenKeys}
                onLegendItemClick={toggleKey}
                onLegendItemHover={setHoverKey}
              />
            }
          />
        )}
        {seriesStyle === 'lines' ? (
          <>
            {balanceArea ? (
              <Area
                type={curve}
                dataKey="balance"
                stroke="var(--color-balance)"
                fill={`url(#${gradientPrefix}-balance-fill)`}
                dot={dotRenderer}
                activeDot={{ r: 4, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                isAnimationActive
                animationDuration={320}
                animationEasing="ease-out"
                {...lineStrokeProps}
                {...balanceArea}
              />
            ) : null}
            {incomeLine ? (
              <>
                <Area
                  type={curve}
                  dataKey="income"
                  stroke="none"
                  fill={`url(#${gradientPrefix}-income-fill)`}
                  dot={false}
                  isAnimationActive
                  animationDuration={260}
                  animationEasing="ease-out"
                />
                <Line
                  type={curve}
                  dataKey="income"
                  stroke="var(--color-income)"
                  dot={dotRenderer}
                  activeDot={{ r: 4, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                  isAnimationActive
                  animationDuration={280}
                  animationEasing="ease-out"
                  {...lineStrokeProps}
                  {...incomeLine}
                />
              </>
            ) : null}
            {expenseLine ? (
              <>
                <Area
                  type={curve}
                  dataKey="expense"
                  stroke="none"
                  fill={`url(#${gradientPrefix}-expense-fill)`}
                  dot={false}
                  isAnimationActive
                  animationDuration={260}
                  animationEasing="ease-out"
                />
                <Line
                  type={curve}
                  dataKey="expense"
                  stroke="var(--color-expense)"
                  dot={dotRenderer}
                  activeDot={{ r: 4, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                  isAnimationActive
                  animationDuration={280}
                  animationEasing="ease-out"
                  {...lineStrokeProps}
                  {...expenseLine}
                />
              </>
            ) : null}
          </>
        ) : seriesStyle === 'bars' ? (
          <>
            {balanceArea ? (
              <Area
                yAxisId="bal"
                type={curve}
                dataKey="balance"
                stroke="var(--color-balance)"
                fill="var(--color-balance)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                isAnimationActive
                animationDuration={320}
                animationEasing="ease-out"
                {...lineStrokeProps}
                {...balanceArea}
              />
            ) : null}
            {incomeBar ? (
              <Bar
                yAxisId="flow"
                dataKey="income"
                fill="var(--color-income)"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                isAnimationActive
                animationDuration={280}
                animationEasing="ease-out"
                {...incomeBar}
              />
            ) : null}
            {expenseBar ? (
              <Bar
                yAxisId="flow"
                dataKey="expense"
                fill="var(--color-expense)"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                isAnimationActive
                animationDuration={280}
                animationEasing="ease-out"
                {...expenseBar}
              />
            ) : null}
          </>
        ) : (
          <>
            <Bar
              dataKey="periodNet"
              name={tooltipLabels.periodNet}
              fill={chartSemanticHsl.income}
              radius={[6, 6, 6, 6]}
              maxBarSize={44}
              isAnimationActive
              animationDuration={280}
              animationEasing="ease-out"
            >
              {data.map((entry, i) => (
                <Cell
                  key={`net-${entry.monthLabel}-${i}`}
                  fill={
                    entry.periodNet >= 0
                      ? chartSemanticHsl.income
                      : chartSemanticHsl.expense
                  }
                />
              ))}
            </Bar>
            <ReferenceLine
              y={0}
              stroke="hsl(var(--border))"
              strokeOpacity={0.9}
              strokeWidth={1}
            />
          </>
        )}
      </ComposedChart>
    </ChartContainer>
  )
}
