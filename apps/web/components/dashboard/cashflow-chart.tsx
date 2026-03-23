'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format-utils'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CashflowDataPointDetailed } from '@/app/actions/finance'
import { chartMonthYearShortEs } from '@/lib/chart-date-labels'

export type CashflowRange = 'currentMonth' | 'last3' | 'last6' | 'last12'

const RANGES: { value: CashflowRange; key: string }[] = [
  { value: 'currentMonth', key: 'cashflowRangeCurrentMonth' },
  { value: 'last3', key: 'cashflowRangeLast3' },
  { value: 'last6', key: 'cashflowRangeLast6' },
  { value: 'last12', key: 'cashflowRangeLast12' },
]

function formatMonthKey(monthKey: string): string {
  return chartMonthYearShortEs(monthKey)
}

interface CashflowChartProps {
  timeline: CashflowDataPointDetailed[]
}

/**
 * Cashflow chart: Ingresos, Gastos, Balance acumulado (same as Finanzas > Cashflow).
 * Toggles slice the loaded 12-month timeline client-side; no reload.
 */
export function CashflowChart({ timeline }: CashflowChartProps) {
  const t = useTranslations('dashboard')
  const [range, setRange] = useState<CashflowRange>('last6')

  const handleRangeChange = useCallback((v: string) => {
    if (v === 'currentMonth' || v === 'last3' || v === 'last6' || v === 'last12') {
      setRange(v)
    }
  }, [])

  const slicedData = useMemo(() => {
    if (!timeline?.length) return []
    if (range === 'currentMonth') {
      const now = new Date()
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const point = timeline.find((p) => p.month === currentMonthKey)
      if (point) return [point]
      // Si el backend no incluyó el mes corriente (ej. rango corto), mostrar un punto en cero
      return [
        {
          month: currentMonthKey,
          income: 0,
          expense: 0,
          balance: timeline.length ? timeline[timeline.length - 1].balance : 0,
          overhead: 0,
          projectExpenses: {},
        },
      ]
    }
    if (range === 'last3') return timeline.slice(-3)
    if (range === 'last6') return timeline.slice(-6)
    return timeline.slice(-12)
  }, [timeline, range])

  const chartData = useMemo(
    () =>
      slicedData.map((point) => ({
        ...point,
        monthLabel: formatMonthKey(point.month),
      })),
    [slicedData]
  )

  const tooltipFormatter = (value: number) => formatCurrency(value, 'ARS')
  const yAxisFormatter = (value: number) =>
    Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)

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
        {chartData.length > 0 ? (
          <ResponsiveContainer key={range} width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
              <Legend wrapperStyle={{ paddingTop: '1rem' }} />
              <Area
                type="monotone"
                dataKey="income"
                name={t('income')}
                stackId="a"
                fill="hsl(var(--chart-2))"
                stroke="hsl(var(--chart-2))"
                animationDuration={900}
                animationBegin={0}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name={t('expenses')}
                stackId="b"
                fill="hsl(var(--chart-4))"
                stroke="hsl(var(--chart-4))"
                animationDuration={900}
                animationBegin={100}
              />
              <Area
                type="monotone"
                dataKey="balance"
                name={t('net')}
                fill="transparent"
                stroke="hsl(var(--chart-3))"
                strokeDasharray="4 4"
                animationDuration={900}
                animationBegin={200}
              />
            </AreaChart>
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
