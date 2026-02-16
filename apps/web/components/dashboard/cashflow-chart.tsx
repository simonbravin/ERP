'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format-utils'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CashflowDataPoint } from '@/app/actions/dashboard'

export type CashflowRange = 'currentMonth' | 'last3' | 'last6' | 'last12'

const RANGES: { value: CashflowRange; key: string }[] = [
  { value: 'currentMonth', key: 'cashflowRangeCurrentMonth' },
  { value: 'last3', key: 'cashflowRangeLast3' },
  { value: 'last6', key: 'cashflowRangeLast6' },
  { value: 'last12', key: 'cashflowRangeLast12' },
]

interface CashflowChartProps {
  data: CashflowDataPoint[]
}

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

/**
 * Cashflow chart: income, expenses, net. Toggle changes temporal view (mes actual, 3/6/12 meses).
 * Data is sorted by month ascending; we slice from the end for the selected range.
 */
export function CashflowChart({ data }: CashflowChartProps) {
  const t = useTranslations('dashboard')
  const [range, setRange] = useState<CashflowRange>('last6')

  const handleRangeChange = useCallback((v: string) => {
    if (v === 'currentMonth' || v === 'last3' || v === 'last6' || v === 'last12') {
      setRange(v)
    }
  }, [])

  // Slice by selected range (data sorted by month ascending → last N months)
  const slicedData = useMemo(() => {
    if (!data?.length) return []
    if (range === 'currentMonth') return data.slice(-1)
    if (range === 'last3') return data.slice(-3)
    if (range === 'last6') return data.slice(-6)
    return data.slice(-12)
  }, [data, range])

  const formattedData = useMemo(() => slicedData.map((item) => {
    const [year, month] = item.month.split('-')
    const monthIndex = parseInt(month, 10) - 1
    const monthLabel = `${MONTH_NAMES[monthIndex]} ${year.slice(2)}`
    return { ...item, monthLabel }
  }), [slicedData])

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; color: string }>
    label?: string
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 font-medium text-foreground">{label}</p>
          {payload.map((entry) => (
            <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t('cashflowTitle')}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('cashflowSubtitle')}
          </p>
        </div>
        <Tabs value={range} onValueChange={handleRangeChange} className="w-full sm:w-auto">
          <TabsList className="inline-flex h-10 w-full gap-0.5 rounded-lg bg-muted/80 p-1 sm:w-auto">
            {RANGES.map(({ value, key }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-w-0 flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-initial sm:text-sm"
              >
                {t(key)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-5 h-80 min-h-[280px] w-full min-w-0" style={{ minHeight: 280 }}>
        {formattedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={280} minWidth={0}>
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--color-border)]" stroke="var(--color-border)" />
              <XAxis
                dataKey="monthLabel"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickLine={false}
                tick={{ fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickLine={false}
                tick={{ fill: 'var(--color-muted-foreground)' }}
                tickFormatter={(value: number) => formatCurrencyCompact(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '1rem', color: 'var(--color-foreground)' }}
              />
              <Line
                type="monotone"
                dataKey="income"
                name={t('income')}
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name={t('expenses')}
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="net"
                name={t('net')}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('noDataAvailable')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
