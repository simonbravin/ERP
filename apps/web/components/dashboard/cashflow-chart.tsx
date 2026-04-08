'use client'

import { useState, useMemo, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CashflowDataPointDetailed } from '@/app/actions/finance'
import { chartMonthYearShortEs } from '@/lib/chart-date-labels'
import { chartSemanticHsl } from '@/lib/chart-theme'
import { CashflowTimelineComposedChart } from '@/components/charts/cashflow-timeline-composed-chart'
import type { ChartConfig } from '@/components/ui/chart'

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
 * Cashflow: income / expense lines + subtle running-balance area (linear interpolation).
 * Range tabs slice the loaded timeline client-side.
 */
export function CashflowChart({ timeline }: CashflowChartProps) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
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
        monthLabel: formatMonthKey(point.month),
        income: point.income,
        expense: point.expense,
        balance: point.balance,
        periodNet: point.income - point.expense,
      })),
    [slicedData]
  )

  const chartConfig = {
    income: { label: t('income'), color: chartSemanticHsl.income },
    expense: { label: t('expenses'), color: chartSemanticHsl.expense },
    balance: {
      label: t('cashflowRunningBalance'),
      color: chartSemanticHsl.runningBalance,
    },
  } satisfies ChartConfig

  const tooltipLabels = {
    income: t('income'),
    expenses: t('expenses'),
    runningBalance: t('cashflowRunningBalance'),
    periodNet: t('cashflowPeriodNet'),
    vsPrevious: t('cashflowVsPrevious'),
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-xl border border-border/60 bg-card p-6 shadow-sm">
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

      <div className="mt-5 flex min-h-[280px] w-full min-w-0 flex-1 flex-col">
        {chartData.length > 0 ? (
          <CashflowTimelineComposedChart
            animationKey={range}
            data={chartData}
            config={chartConfig}
            currency="ARS"
            locale={locale === 'en' ? 'en-US' : 'es-AR'}
            tooltipLabels={tooltipLabels}
            className="aspect-auto min-h-[280px] w-full"
          />
        ) : (
          <div className="flex min-h-[280px] flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('noDataAvailable')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
