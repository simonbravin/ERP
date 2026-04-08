'use client'

import { useMemo } from 'react'
import {
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { ChartCard } from '@/components/charts/chart-card'
import { CompanyFinanceKPICards } from '@/components/finance/company-finance-kpi-cards'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import { chartMonthYearShortEs } from '@/lib/chart-date-labels'
import { useTranslations } from 'next-intl'
import { AlertCircle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { ProjectFinanceExecutiveDashboard } from '@/app/actions/finance'
import type { FinanceAlert } from '@/app/actions/finance'
import {
  CHART_PIE_PLACEHOLDER_FILL,
  chartSeriesColor,
  chartSemanticHsl,
  groupPieSlicesForDisplay,
} from '@/lib/chart-theme'
import { formatChartAxisCurrency } from '@/lib/chart-format'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  EXPENSE: 'Gastos',
  PURCHASE: 'Compras',
  OVERHEAD: 'Generales',
}

interface ProjectFinanceDashboardClientProps {
  data: ProjectFinanceExecutiveDashboard
  alerts?: FinanceAlert[]
}

export function ProjectFinanceDashboardClient({ data, alerts = [] }: ProjectFinanceDashboardClientProps) {
  const t = useTranslations('finance')
  const kpisData = {
    totalIncome: data.summary.totalIncome,
    totalExpense: data.summary.totalExpense,
    balance: data.summary.balance,
    pendingIncome: data.summary.pendingIncome,
    pendingExpense: data.summary.pendingExpense,
    currentMonthIncome: data.summary.currentMonthIncome,
    currentMonthExpense: data.summary.currentMonthExpense,
    currentMonthNet: data.summary.currentMonthNet,
    unallocatedOverhead: data.summary.unallocatedOverhead,
  }

  const trendChartData = useMemo(
    () =>
      data.monthlyTrend.map((m) => ({
        mes: chartMonthYearShortEs(m.month),
        Ingresos: m.income,
        Gastos: m.expense,
        Balance: m.balance,
      })),
    [data.monthlyTrend]
  )

  const trendChartConfig = {
    Ingresos: { label: 'Ingresos', color: chartSemanticHsl.income },
    Gastos: { label: 'Gastos', color: chartSemanticHsl.expense },
    Balance: { label: 'Balance', color: chartSemanticHsl.runningBalance },
  } satisfies ChartConfig

  const axisCurrency = useMemo(
    () => (v: number) =>
      formatChartAxisCurrency(v, { locale: 'es-AR', currency: 'ARS' }),
    []
  )

  const valueFmt = useMemo(
    () => (v: number) => formatCurrency(v, 'ARS'),
    []
  )

  const compositionRawSlices = useMemo(
    () =>
      data.expensesByType
        .filter((c) => c.total > 0)
        .map((c) => ({
          name: EXPENSE_TYPE_LABELS[c.type] ?? c.type,
          value: c.total,
        })),
    [data.expensesByType]
  )

  const compositionDisplaySlices = useMemo(
    () => groupPieSlicesForDisplay(compositionRawSlices, 'Otros', 6, 5),
    [compositionRawSlices]
  )

  const compositionChartData = useMemo(
    () =>
      compositionDisplaySlices.map((s, i) => ({
        ...s,
        id: `p${i}`,
      })),
    [compositionDisplaySlices]
  )

  const compositionChartConfig = useMemo(() => {
    const c: ChartConfig = {}
    compositionDisplaySlices.forEach((s, i) => {
      c[`p${i}`] = { label: s.name, color: chartSeriesColor(i) }
    })
    return c
  }, [compositionDisplaySlices])

  const suppliersChartConfig = {
    total: { label: 'Total', color: 'hsl(var(--chart-3))' },
  } satisfies ChartConfig

  const suppliersChartData = data.topSuppliers.map((s) => ({
    name: s.supplierName.length > 20 ? s.supplierName.slice(0, 20) + '…' : s.supplierName,
    total: s.total,
  }))

  const consumedPct =
    data.budgeted > 0 ? Math.min(100, (data.consumed / data.budgeted) * 100) : 0

  return (
    <div className="space-y-6">
      {(data.budgeted > 0 || data.consumed > 0) && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t('budgetVsConsumed', { defaultValue: 'Presupuesto / Consumido' })}
          </h3>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">
                {t('budgeted', { defaultValue: 'Presupuesto' })}
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {formatCurrency(data.budgeted, 'ARS')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('consumed', { defaultValue: 'Consumido' })}
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {formatCurrency(data.consumed, 'ARS')}
              </p>
            </div>
            {data.budgeted > 0 && (
              <div className="min-w-[120px] flex-1">
                <p className="mb-1 text-xs text-muted-foreground">
                  {t('consumedPct', { defaultValue: 'Consumido' })} ({consumedPct.toFixed(0)}%)
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${consumedPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CompanyFinanceKPICards data={kpisData} />

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              variant={alert.severity === 'danger' ? 'destructive' : 'default'}
              className={
                alert.severity === 'danger'
                  ? ''
                  : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
              }
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>
                <span className="block text-sm">{alert.message}</span>
                {alert.link && (
                  <Link href={alert.link} className="mt-2 inline-block">
                    <Button variant="outline" size="sm">
                      Ver detalle
                    </Button>
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <ChartCard
        title="Tendencia mensual (12 meses)"
        description="Ingresos vs gastos por mes"
      >
        <div className="h-[280px]">
          <ChartContainer
            config={trendChartConfig}
            className="aspect-auto h-[280px] min-h-[280px] w-full"
          >
            <ComposedChart
              data={trendChartData}
              margin={{ top: 18, right: 20, left: 4, bottom: 8 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.45}
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="mes"
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
                cursor={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.55 }}
                content={
                  <ChartTooltipContent valueFormatter={(v) => valueFmt(Number(v))} />
                }
              />
              <ChartLegend
                verticalAlign="bottom"
                content={<ChartLegendContent className="pt-4" />}
              />
              <Area
                type="linear"
                dataKey="Balance"
                stroke="var(--color-Balance)"
                strokeWidth={2.6}
                fill="var(--color-Balance)"
                fillOpacity={0.12}
                dot={false}
              />
              <Line
                type="linear"
                dataKey="Ingresos"
                stroke="var(--color-Ingresos)"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="linear"
                dataKey="Gastos"
                stroke="var(--color-Gastos)"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={t('chartExpenseComposition')}
          description={t('chartExpenseCompositionDesc')}
        >
          <div className="h-[280px]">
            <ChartContainer
              config={compositionChartConfig}
              className="aspect-auto mx-auto h-[280px] w-full max-w-[320px]"
            >
              <PieChart>
                <Pie
                  data={compositionChartData}
                  dataKey="value"
                  nameKey="id"
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill={CHART_PIE_PLACEHOLDER_FILL}
                >
                  {compositionChartData.map((_, index) => (
                    <Cell key={index} fill={`var(--color-p${index})`} />
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
        </ChartCard>

        <ChartCard
          title={t('chartTopSuppliers')}
          description={t('chartTopSuppliersDesc')}
        >
          <div className="h-[260px]">
            <ChartContainer
              config={suppliersChartConfig}
              className="aspect-auto h-[260px] min-h-[260px] w-full"
            >
              <BarChart
                data={suppliersChartData}
                layout="vertical"
                margin={{ top: 16, right: 20, left: 4, bottom: 8 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.4}
                  strokeDasharray="4 4"
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 12 }}
                  tickFormatter={axisCurrency}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  isAnimationActive={false}
                  content={
                    <ChartTooltipContent valueFormatter={(v) => valueFmt(Number(v))} />
                  }
                />
                <Bar
                  dataKey="total"
                  fill="var(--color-total)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </ChartCard>
      </div>

      {data.summary.upcomingPayments.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Próximos vencimientos (30 días)
          </h3>
          <ul className="space-y-2">
            {data.summary.upcomingPayments.map((payment) => {
              const dueDate = payment.dueDate ? new Date(payment.dueDate) : null
              const daysUntilDue = dueDate
                ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null
              return (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{payment.description}</p>
                    <p className="text-sm text-muted-foreground">{payment.supplier}</p>
                  </div>
                  <div className="text-right tabular-nums font-medium">
                    {formatCurrency(payment.amount, 'ARS')}
                    {dueDate && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDateShort(dueDate)}
                        {daysUntilDue != null &&
                          ` · ${daysUntilDue <= 0 ? 'Vencido' : `${daysUntilDue} días`}`}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
