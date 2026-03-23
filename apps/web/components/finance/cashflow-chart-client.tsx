'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/format-utils'
import { chartMonthLongYearEs, chartMonthYearShortEs } from '@/lib/chart-date-labels'
import type {
  CashflowDataPoint,
  ProjectCashflowBreakdownByWbsItem,
} from '@/app/actions/finance'

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

const CHART_COLORS = [
  'hsl(var(--chart-4))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
]

export function CashflowChartClient({
  projectId: _projectId,
  initialData,
  range: _range,
  timelineByWbs = [],
  breakdownByWbs = [],
}: Props) {
  const data = initialData

  const chartData = data.map((point) => ({
    month: formatMonthKey(point.month),
    monthKey: point.month,
    Ingresos: point.income,
    Gastos: point.expense,
    Balance: point.balance,
  }))

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

  const hasBreakdown = breakdownChartData.length > 0 && wbsBarKeys.length > 0

  const yAxisFormatter = (value: number) =>
    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
  const tooltipFormatter = (value: number) => formatCurrency(value, 'ARS')

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
                <div className="h-80 w-full min-w-0">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis
                          tickFormatter={yAxisFormatter}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number | undefined) =>
                            value != null ? formatCurrency(value, 'ARS') : ''
                          }
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius)',
                          }}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.monthKey
                              ? chartMonthLongYearEs(payload[0].payload.monthKey)
                              : ''
                          }
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="Ingresos"
                          stackId="1"
                          stroke="hsl(var(--chart-2))"
                          fill="hsl(var(--chart-2) / 0.3)"
                        />
                        <Area
                          type="monotone"
                          dataKey="Gastos"
                          stackId="2"
                          stroke="hsl(var(--chart-4))"
                          fill="hsl(var(--chart-4) / 0.3)"
                        />
                        <Area
                          type="monotone"
                          dataKey="Balance"
                          stroke="hsl(var(--chart-1))"
                          fill="transparent"
                          strokeDasharray="4 4"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-80 items-center justify-center text-muted-foreground">
                      No hay datos para el rango seleccionado
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="breakdown" className="mt-4">
                <div className="h-80 w-full min-w-0">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={breakdownChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={tooltipFormatter}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                        }}
                      />
                      <Legend />
                      {wbsBarKeys.map((key, idx) => {
                        const item = breakdownByWbs.find(
                          (b) => (b.wbsNodeId ?? '__null__') === key
                        )
                        const label =
                          key === '__other__'
                            ? 'Otros'
                            : key === '__null__'
                              ? 'Sin partida'
                              : item
                                ? `${item.wbsNodeCode} - ${item.wbsNodeName.substring(0, 15)}${item.wbsNodeName.length > 15 ? '…' : ''}`
                                : key
                        return (
                          <Bar
                            key={key}
                            dataKey={key}
                            name={label}
                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            stackId="g"
                            animationDuration={300}
                            animationBegin={idx * 50}
                          />
                        )
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-80 min-h-[200px] w-full min-w-0">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number | undefined) =>
                        value != null ? formatCurrency(value, 'ARS') : ''
                      }
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                      }}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.monthKey
                          ? chartMonthLongYearEs(payload[0].payload.monthKey)
                          : ''
                      }
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="Ingresos"
                      stackId="1"
                      stroke="hsl(var(--chart-2))"
                      fill="hsl(var(--chart-2) / 0.3)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Gastos"
                      stackId="2"
                      stroke="hsl(var(--chart-4))"
                      fill="hsl(var(--chart-4) / 0.3)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Balance"
                      stroke="hsl(var(--chart-1))"
                      fill="transparent"
                      strokeDasharray="4 4"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-80 items-center justify-center text-muted-foreground">
                  No hay datos para el rango seleccionado
                </div>
              )}
            </div>
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
