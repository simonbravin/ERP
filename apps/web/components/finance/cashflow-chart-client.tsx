'use client'

import { useCallback, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/format-utils'
import { formatChartAxisCurrency } from '@/lib/chart-format'
import { chartMonthLongYearEs, chartMonthYearShortEs } from '@/lib/chart-date-labels'
import type {
  CashflowDataPoint,
  ProjectCashflowBreakdownByWbsItem,
} from '@/app/actions/finance'
import { chartSemanticHsl, chartSeriesColor } from '@/lib/chart-theme'
import {
  CashflowTimelineComposedChart,
  type CashflowTimelineSeriesStyle,
} from '@/components/charts/cashflow-timeline-composed-chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

type TimelineByWbsItem = { month: string; wbsExpenses: Record<string, number> }

interface Props {
  projectId: string
  initialData: CashflowDataPoint[]
  range?: { from: Date; to: Date }
  timelineByWbs?: TimelineByWbsItem[]
  breakdownByWbs?: ProjectCashflowBreakdownByWbsItem[]
}

function formatMonthKey(monthKey: string): string {
  return chartMonthYearShortEs(monthKey)
}

function wbsBarLabel(
  key: string,
  breakdownByWbs: ProjectCashflowBreakdownByWbsItem[]
): string {
  const item = breakdownByWbs.find((b) => (b.wbsNodeId ?? '__null__') === key)
  if (key === '__other__') return 'Otros'
  if (key === '__null__') return 'Sin partida'
  if (item) {
    return `${item.wbsNodeCode} - ${item.wbsNodeName.substring(0, 15)}${item.wbsNodeName.length > 15 ? '…' : ''}`
  }
  return key
}

export function CashflowChartClient({
  projectId: _projectId,
  initialData,
  range: _range,
  timelineByWbs = [],
  breakdownByWbs = [],
}: Props) {
  const data = initialData
  const [cashflowSeriesStyle, setCashflowSeriesStyle] =
    useState<CashflowTimelineSeriesStyle>('lines')

  const cashflowRows = useMemo(
    () =>
      data.map((point) => ({
        monthLabel: formatMonthKey(point.month),
        monthKey: point.month,
        income: point.income,
        expense: point.expense,
        balance: point.balance,
        periodNet: point.income - point.expense,
      })),
    [data]
  )

  const cashflowChartConfig = {
    income: { label: 'Ingresos', color: chartSemanticHsl.income },
    expense: { label: 'Gastos', color: chartSemanticHsl.expense },
    balance: {
      label: 'Balance acumulado',
      color: chartSemanticHsl.runningBalance,
    },
    periodNet: { label: 'Neto del período', color: chartSemanticHsl.income },
  } satisfies ChartConfig

  const cashflowTooltipLabels = {
    income: 'Ingresos',
    expenses: 'Gastos',
    runningBalance: 'Balance acumulado',
    periodNet: 'Neto del período',
    vsPrevious: 'vs. mes anterior',
    periodNetLegendPositive: 'Neto positivo (ingresos − gastos)',
    periodNetLegendNegative: 'Neto negativo (ingresos − gastos)',
  }

  const breakdownChartData = useMemo(() => {
    if (timelineByWbs.length === 0) return []
    return timelineByWbs.map(({ month, wbsExpenses }) => ({
      monthLabel: formatMonthKey(month),
      monthKey: month,
      ...wbsExpenses,
    }))
  }, [timelineByWbs])

  const wbsBarKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const row of timelineByWbs) {
      for (const k of Object.keys(row.wbsExpenses)) keys.add(k)
    }
    return Array.from(keys)
  }, [timelineByWbs])

  const wbsStackChartConfig = useMemo(() => {
    const c: ChartConfig = {}
    wbsBarKeys.forEach((key, idx) => {
      c[key] = {
        label: wbsBarLabel(key, breakdownByWbs),
        color: chartSeriesColor(idx),
      }
    })
    return c
  }, [wbsBarKeys, breakdownByWbs])

  const hasBreakdown = breakdownChartData.length > 0 && wbsBarKeys.length > 0

  const axisCurrency = useCallback(
    (v: number) => formatChartAxisCurrency(v, { locale: 'es-AR', currency: 'ARS' }),
    []
  )

  const valueFmt = useCallback((v: number) => formatCurrency(v, 'ARS'), [])

  const cashflowChart = (
    <>
      {cashflowRows.length > 0 ? (
        <div className="space-y-3">
          <Tabs
            value={cashflowSeriesStyle}
            onValueChange={(v) => {
              if (v === 'lines' || v === 'bars' || v === 'periodNet') {
                setCashflowSeriesStyle(v)
              }
            }}
            className="w-full"
          >
            <TabsList className="inline-flex h-auto min-h-9 w-full flex-wrap gap-0.5 rounded-lg bg-muted/60 p-1 sm:w-auto">
              <TabsTrigger value="lines" className="rounded-md px-2.5 text-xs sm:px-3 sm:text-sm">
                Líneas
              </TabsTrigger>
              <TabsTrigger value="bars" className="rounded-md px-2.5 text-xs sm:px-3 sm:text-sm">
                Barras
              </TabsTrigger>
              <TabsTrigger value="periodNet" className="rounded-md px-2.5 text-xs sm:px-3 sm:text-sm">
                Solo neto
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="h-80 w-full min-w-0">
            <CashflowTimelineComposedChart
              animationKey={`${cashflowRows.length}-${cashflowRows[0]?.monthKey ?? ''}-${cashflowSeriesStyle}`}
              data={cashflowRows}
              config={cashflowChartConfig}
              currency="ARS"
              locale="es-AR"
              tooltipLabels={cashflowTooltipLabels}
              seriesStyle={cashflowSeriesStyle}
              className="aspect-auto h-full min-h-[280px] w-full"
            />
          </div>
        </div>
      ) : (
        <div className="flex h-80 items-center justify-center text-muted-foreground">
          No hay datos para el rango seleccionado
        </div>
      )}
    </>
  )

  const wbsStackChart = (
    <div className="h-80 w-full min-w-0">
      <ChartContainer
        config={wbsStackChartConfig}
        className="aspect-auto h-full min-h-[280px] w-full"
      >
        <BarChart
          data={breakdownChartData}
          margin={{ top: 18, right: 20, left: 4, bottom: 8 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
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
            tickFormatter={axisCurrency}
          />
          <ChartTooltip
            isAnimationActive={false}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const mk = (payload?.[0]?.payload as { monthKey?: string } | undefined)
                    ?.monthKey
                  return mk ? chartMonthLongYearEs(mk) : ''
                }}
                valueFormatter={(v) => valueFmt(Number(v))}
              />
            }
          />
          <ChartLegend
            verticalAlign="bottom"
            content={<ChartLegendContent className="pt-4" />}
          />
          {wbsBarKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="g"
              fill={`var(--color-${key})`}
              radius={
                idx === wbsBarKeys.length - 1 ? ([4, 4, 0, 0] as const) : ([0, 0, 0, 0] as const)
              }
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Evolución Temporal</CardTitle>
        </CardHeader>
        <CardContent>
          {hasBreakdown ? (
            <Tabs defaultValue="cashflow" className="w-full">
              <TabsList>
                <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
                <TabsTrigger value="breakdown">Desglose Gastos</TabsTrigger>
              </TabsList>
              <TabsContent value="cashflow" className="mt-4">
                {cashflowChart}
              </TabsContent>
              <TabsContent value="breakdown" className="mt-4">
                {wbsStackChart}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-80 min-h-[200px] w-full min-w-0">{cashflowChart}</div>
          )}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">Detalle Mensual</h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Mes
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Ingresos
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Gastos
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Neto
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((point) => {
                    const net = point.income - point.expense
                    return (
                      <tr key={point.month} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          {chartMonthLongYearEs(point.month)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatCurrency(point.income, 'ARS')}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatCurrency(point.expense, 'ARS')}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${
                            net >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {formatCurrency(net, 'ARS')}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatCurrency(point.balance, 'ARS')}
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
    </div>
  )
}
