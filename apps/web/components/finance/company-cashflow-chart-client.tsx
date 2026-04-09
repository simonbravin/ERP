'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { formatCurrency } from '@/lib/format-utils'
import { formatChartAxisCurrency } from '@/lib/chart-format'
import { chartSemanticHsl } from '@/lib/chart-theme'
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
import type {
  CashflowDataPointDetailed,
  CashflowBreakdownItem,
} from '@/app/actions/finance'
import { chartMonthLongYearEs, chartMonthYearShortEs } from '@/lib/chart-date-labels'

interface Props {
  initialData: CashflowDataPointDetailed[]
  breakdown: CashflowBreakdownItem[]
  range: { from: Date; to: Date }
}

function formatMonthKey(monthKey: string): string {
  return chartMonthYearShortEs(monthKey)
}

function formatMonthLong(monthKey: string): string {
  return chartMonthLongYearEs(monthKey)
}

export function CompanyCashflowChartClient({
  initialData,
  breakdown: _breakdown,
  range,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [customFrom, setCustomFrom] = useState(
    range.from.toISOString().slice(0, 10)
  )
  const [customTo, setCustomTo] = useState(range.to.toISOString().slice(0, 10))
  const [cashflowSeriesStyle, setCashflowSeriesStyle] =
    useState<CashflowTimelineSeriesStyle>('lines')

  const preset = useMemo(() => {
    const to = range.to.getTime()
    const from = range.from.getTime()
    const months6 = 6 * 30 * 24 * 60 * 60 * 1000
    const months3 = 3 * 30 * 24 * 60 * 60 * 1000
    const months12 = 12 * 30 * 24 * 60 * 60 * 1000
    const diff = to - from
    if (diff <= months3 + 86400000) return '3months'
    if (diff <= months6 + 86400000) return '6months'
    if (diff <= months12 + 86400000) return '12months'
    return 'custom'
  }, [range.from, range.to])

  const setRange = useCallback(
    (from: Date, to: Date) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('from', from.toISOString().slice(0, 10))
      params.set('to', to.toISOString().slice(0, 10))
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const handlePresetChange = (value: string) => {
    const to = new Date()
    let from: Date
    switch (value) {
      case '3months':
        from = new Date(to.getFullYear(), to.getMonth() - 3, 1)
        break
      case '6months':
        from = new Date(to.getFullYear(), to.getMonth() - 6, 1)
        break
      case '12months':
        from = new Date(to.getFullYear(), to.getMonth() - 12, 1)
        break
      default:
        return
    }
    setRange(from, to)
  }

  const handleCustomApply = () => {
    const from = new Date(customFrom)
    const to = new Date(customTo)
    if (from <= to) setRange(from, to)
  }

  const chartData = useMemo(
    () =>
      initialData.map((point) => ({
        ...point,
        monthLabel: formatMonthKey(point.month),
        Proyectos: point.expense - point.overhead,
        periodNet: point.income - point.expense,
      })),
    [initialData]
  )

  const cashflowChartRows = useMemo(
    () =>
      chartData.map(({ monthLabel, income, expense, balance, periodNet }) => ({
        monthLabel,
        income,
        expense,
        balance,
        periodNet,
      })),
    [chartData]
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

  const yAxisFormatter = (value: number) =>
    formatChartAxisCurrency(value, { locale: 'es-AR', currency: 'ARS' })

  const expenseStackChartConfig = {
    overhead: { label: 'Overhead', color: 'hsl(var(--chart-neutral))' },
    Proyectos: { label: 'Proyectos', color: 'hsl(var(--chart-1))' },
  } satisfies ChartConfig

  if (initialData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolución Temporal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground py-8">
            No hay datos de cashflow para el período seleccionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Evolución Temporal</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">Últimos 3 meses</SelectItem>
                <SelectItem value="6months">Últimos 6 meses</SelectItem>
                <SelectItem value="12months">Último año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {preset === 'custom' && (
              <>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-[140px]"
                />
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-[140px]"
                />
                <Button type="button" size="sm" onClick={handleCustomApply}>
                  Aplicar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cashflow">
          <TabsList>
            <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
            <TabsTrigger value="breakdown">Desglose Gastos</TabsTrigger>
          </TabsList>

          <TabsContent value="cashflow" className="mt-4 space-y-3">
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
                animationKey={`${preset}-${initialData.length}-${cashflowSeriesStyle}`}
                data={cashflowChartRows}
                config={cashflowChartConfig}
                currency="ARS"
                locale="es-AR"
                tooltipLabels={cashflowTooltipLabels}
                seriesStyle={cashflowSeriesStyle}
                className="aspect-auto h-full min-h-[280px] w-full"
              />
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="mt-4">
            <div className="h-80 w-full min-w-0">
              <ChartContainer
                config={expenseStackChartConfig}
                className="aspect-auto h-full min-h-[280px] w-full"
              >
                <BarChart
                  data={chartData}
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
                    tickFormatter={yAxisFormatter}
                  />
                  <ChartTooltip
                    isAnimationActive={false}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
                    content={
                      <ChartTooltipContent
                        valueFormatter={(v) => formatCurrency(Number(v), 'ARS')}
                      />
                    }
                  />
                  <ChartLegend
                    verticalAlign="bottom"
                    content={<ChartLegendContent className="pt-4" />}
                  />
                  <Bar
                    dataKey="overhead"
                    stackId="g"
                    fill="var(--color-overhead)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="Proyectos"
                    stackId="g"
                    fill="var(--color-Proyectos)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold">Detalle Mensual</h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Mes</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ingresos</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Gastos</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Overhead</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Proyectos</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Neto</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody>
                {initialData.map((point) => (
                  <tr key={point.month} className="border-b last:border-0">
                    <td className="px-4 py-2">{formatMonthLong(point.month)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(point.income, 'ARS')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(point.expense, 'ARS')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(point.overhead, 'ARS')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(point.expense - point.overhead, 'ARS')}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        point.income - point.expense >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(point.income - point.expense, 'ARS')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(point.balance, 'ARS')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
