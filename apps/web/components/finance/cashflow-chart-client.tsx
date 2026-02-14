'use client'

import { useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/format-utils'
import { getProjectCashflow } from '@/app/actions/finance'
import type { CashflowDataPoint } from '@/app/actions/finance'

interface Props {
  projectId: string
  initialData: CashflowDataPoint[]
}

export function CashflowChartClient({ projectId, initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [preset, setPreset] = useState('6months')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handlePresetChange(value: string) {
    setPreset(value)
    if (value === 'custom') return
    setIsLoading(true)
    try {
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
      const newData = await getProjectCashflow(projectId, { from, to })
      setData(newData)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCustomRange() {
    if (!dateFrom || !dateTo) return
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    if (from > to) return
    setIsLoading(true)
    try {
      const newData = await getProjectCashflow(projectId, { from, to })
      setData(newData)
    } finally {
      setIsLoading(false)
    }
  }

  const chartData = data.map((point) => ({
    month: new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' }).format(
      new Date(point.month + '-01')
    ),
    monthKey: point.month,
    Ingresos: point.income,
    Gastos: point.expense,
    Balance: point.balance,
  }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Evolución Mensual</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={preset} onValueChange={handlePresetChange} disabled={isLoading}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Rango" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">Últimos 3 meses</SelectItem>
                <SelectItem value="6months">Últimos 6 meses</SelectItem>
                <SelectItem value="12months">Último año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[140px]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCustomRange}
                  disabled={!dateFrom || !dateTo || isLoading}
                >
                  Aplicar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 min-h-[200px] w-full min-w-0">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value: number) =>
                      formatCurrency(value, 'USD').replace('USD', '').trim()
                    }
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) =>
                      value != null ? formatCurrency(value) : ''
                    }
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.monthKey
                        ? new Intl.DateTimeFormat('es', {
                            month: 'long',
                            year: 'numeric',
                          }).format(new Date(payload[0].payload.monthKey + '-01'))
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
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No hay datos para el rango seleccionado
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((point) => {
                const net = point.income - point.expense
                return (
                  <TableRow key={point.month}>
                    <TableCell className="font-medium">
                      {new Intl.DateTimeFormat('es', {
                        month: 'long',
                        year: 'numeric',
                      }).format(new Date(point.month + '-01'))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(point.income)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(point.expense)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        net >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                      }`}
                    >
                      {formatCurrency(net)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(point.balance)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
