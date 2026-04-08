'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/format-utils'
import type { ProjectCashflowBreakdownByWbsItem } from '@/app/actions/finance'
import {
  CHART_PIE_PLACEHOLDER_FILL,
  chartSeriesColor,
  groupPieSlicesForDisplay,
} from '@/lib/chart-theme'

interface Props {
  breakdown: ProjectCashflowBreakdownByWbsItem[]
}

export function ProjectCashflowBreakdownChart({ breakdown }: Props) {
  const totalExpenses = breakdown.reduce((sum, i) => sum + i.totalExpense, 0)

  const rawSlices = useMemo(
    () =>
      breakdown.map((item) => ({
        name: `${item.wbsNodeCode} - ${item.wbsNodeName.substring(0, 25)}${item.wbsNodeName.length > 25 ? '...' : ''}`,
        value: item.totalExpense,
      })),
    [breakdown]
  )

  const displaySlices = useMemo(
    () => groupPieSlicesForDisplay(rawSlices, 'Otros', 6, 5),
    [rawSlices]
  )

  const chartData = useMemo(
    () =>
      displaySlices.map((s, i) => ({
        ...s,
        id: `p${i}`,
      })),
    [displaySlices]
  )

  const chartConfig = useMemo(() => {
    const c: ChartConfig = {}
    displaySlices.forEach((s, i) => {
      c[`p${i}`] = { label: s.name, color: chartSeriesColor(i) }
    })
    return c
  }, [displaySlices])

  const valueFmt = useMemo(
    () => (v: number) => formatCurrency(v, 'ARS'),
    []
  )

  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Composición de Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay gastos en el período seleccionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composición de Gastos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 min-h-[200px] w-full">
            <ChartContainer config={chartConfig} className="aspect-auto mx-auto h-[256px] w-full max-w-[320px]">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="id"
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill={CHART_PIE_PLACEHOLDER_FILL}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={`var(--color-p${index})`} />
                  ))}
                </Pie>
                <ChartTooltip
                  isAnimationActive={false}
                  content={
                    <ChartTooltipContent nameKey="id" valueFormatter={(v) => valueFmt(v)} />
                  }
                />
                <ChartLegend content={<ChartLegendContent nameKey="id" />} />
              </PieChart>
            </ChartContainer>
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Partida EDT
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                    Gasto Total
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((item) => {
                  const percentage =
                    totalExpenses > 0 ? (item.totalExpense / totalExpenses) * 100 : 0
                  return (
                    <tr
                      key={item.wbsNodeId ?? '__null__'}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-2">
                        {item.wbsNodeCode} {item.wbsNodeName}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatCurrency(item.totalExpense, 'ARS')}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {percentage.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
