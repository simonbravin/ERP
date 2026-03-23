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
import { formatCurrency } from '@/lib/format-utils'
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
      })),
    [initialData]
  )

  const tooltipFormatter = (value: number) => formatCurrency(value, 'ARS')
  const yAxisFormatter = (value: number) =>
    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)

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

          <TabsContent value="cashflow" className="mt-4">
            <div className="h-80 w-full min-w-0">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
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
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Ingresos"
                    stackId="a"
                    fill="hsl(var(--chart-2))"
                    stroke="hsl(var(--chart-2))"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Gastos"
                    stackId="b"
                    fill="hsl(var(--chart-4))"
                    stroke="hsl(var(--chart-4))"
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="Balance acumulado"
                    fill="transparent"
                    stroke="hsl(var(--chart-3))"
                    strokeDasharray="4 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="mt-4">
            <div className="h-80 w-full min-w-0">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
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
                  <Bar dataKey="overhead" name="Overhead" fill="hsl(var(--chart-4))" stackId="g" animationDuration={900} animationBegin={0} />
                  <Bar
                    dataKey="Proyectos"
                    name="Proyectos"
                    fill="hsl(var(--chart-1))"
                    stackId="g"
                    animationDuration={900}
                    animationBegin={100}
                  />
                </BarChart>
              </ResponsiveContainer>
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
