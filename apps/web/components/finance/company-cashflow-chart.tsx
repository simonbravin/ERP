'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format-utils'
import type { CompanyCashflowPoint } from '@/app/actions/finance'
import { chartAxis, chartFinanceLines } from '@/lib/chart-theme'

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
      <div className="h-80 min-h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} />
            <XAxis dataKey="monthLabel" stroke={chartAxis.tick} fontSize={12} tickLine={false} />
            <YAxis
              stroke={chartAxis.tick}
              fontSize={12}
              tickLine={false}
              tickFormatter={(v: number) => formatCurrencyCompact(v, 'es-AR', 'ARS')}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value, 'ARS')}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.monthLabel ?? ''}
            />
            <Legend wrapperStyle={{ paddingTop: '1rem' }} />
            <Line
              type="monotone"
              dataKey="income"
              name="Ingresos"
              stroke={chartFinanceLines.income}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name="Gastos"
              stroke={chartFinanceLines.expense}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="overhead"
              name="Overhead"
              stroke={chartFinanceLines.overhead}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="balance"
              name="Balance acumulado"
              stroke={chartFinanceLines.balance}
              strokeWidth={2}
              dot={{ r: 3 }}
              strokeDasharray="4 4"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
