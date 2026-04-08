'use client'

import { useMemo } from 'react'
import { useChartSeriesInteraction } from '@/hooks/use-chart-series-interaction'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/format-utils'
import type { CompanyCashflowPoint } from '@/app/actions/finance'
import { chartFinanceLines } from '@/lib/chart-theme'
import { formatChartAxisCurrency } from '@/lib/chart-format'

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

interface CompanyCashflowChartProps {
  initialData: CompanyCashflowPoint[]
}

export function CompanyCashflowChart({ initialData }: CompanyCashflowChartProps) {
  const chartData = useMemo(() => {
    return initialData.map((d) => {
      const [year, month] = d.month.split('-')
      const monthIndex = parseInt(month, 10) - 1
      const label = `${MONTH_NAMES[monthIndex]} ${year.slice(2)}`
      return {
        ...d,
        monthLabel: label,
      }
    })
  }, [initialData])

  const chartConfig = {
    income: { label: 'Ingresos', color: chartFinanceLines.income },
    expense: { label: 'Gastos', color: chartFinanceLines.expense },
    overhead: { label: 'Overhead', color: chartFinanceLines.overhead },
    balance: {
      label: 'Balance acumulado',
      color: chartFinanceLines.balance,
    },
  } satisfies ChartConfig

  const {
    hiddenKeys,
    setHoverKey,
    toggleKey,
    linePresentation,
  } = useChartSeriesInteraction()

  const incomeLine = linePresentation('income', 1.5)
  const expenseLine = linePresentation('expense', 1.5)
  const overheadLine = linePresentation('overhead', 1.5)
  const balanceLine = linePresentation('balance', 2.6)

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No hay datos de cashflow para el período seleccionado
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="min-h-[280px] w-full min-w-0">
        <ChartContainer config={chartConfig} className="aspect-auto min-h-[280px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 16, right: 18, left: 4, bottom: 8 }}
            onMouseLeave={() => setHoverKey(null)}
          >
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
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={58}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) =>
                formatChartAxisCurrency(v, { locale: 'es-AR', currency: 'ARS' })
              }
            />
            <ChartTooltip
              isAnimationActive={false}
              cursor={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.55 }}
              content={
                <ChartTooltipContent
                  className="min-w-[200px]"
                  valueFormatter={(v) => formatCurrency(v, 'ARS')}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.monthLabel ?? ''
                  }
                />
              }
            />
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
            {incomeLine ? (
              <Line
                type="linear"
                dataKey="income"
                stroke="var(--color-income)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                isAnimationActive
                animationDuration={280}
                animationEasing="ease-out"
                {...incomeLine}
              />
            ) : null}
            {expenseLine ? (
              <Line
                type="linear"
                dataKey="expense"
                stroke="var(--color-expense)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                isAnimationActive
                animationDuration={280}
                animationEasing="ease-out"
                {...expenseLine}
              />
            ) : null}
            {overheadLine ? (
              <Line
                type="linear"
                dataKey="overhead"
                stroke="var(--color-overhead)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                isAnimationActive
                animationDuration={280}
                animationEasing="ease-out"
                {...overheadLine}
              />
            ) : null}
            {balanceLine ? (
              <Line
                type="linear"
                dataKey="balance"
                stroke="var(--color-balance)"
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                isAnimationActive
                animationDuration={320}
                animationEasing="ease-out"
                {...balanceLine}
              />
            ) : null}
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  )
}
