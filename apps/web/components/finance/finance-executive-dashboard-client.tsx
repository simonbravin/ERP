'use client'

import { useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import { ChartCard } from '@/components/charts/chart-card'
import { CompanyFinanceKPICards } from '@/components/finance/company-finance-kpi-cards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import { chartMonthYearShortEs } from '@/lib/chart-date-labels'
import { Download, AlertTriangle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { FinanceExecutiveDashboard, FinanceAlert } from '@/app/actions/finance'
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
import { useChartSeriesInteraction } from '@/hooks/use-chart-series-interaction'

const CATEGORY_LABELS: Record<string, string> = {
  EXPENSE: 'Gastos',
  PURCHASE: 'Compras',
  OVERHEAD: 'Generales',
}

interface Props {
  data: FinanceExecutiveDashboard
  alerts?: FinanceAlert[]
}

export function FinanceExecutiveDashboardClient({ data, alerts = [] }: Props) {
  const tFin = useTranslations('finance')
  const [isExporting, setIsExporting] = useState(false)
  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const url = `/api/pdf?template=finance-dashboard&locale=${encodeURIComponent(locale)}&showEmitidoPor=1&showFullCompanyData=1`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? tFin('toast.executiveExportError'))
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? 'dashboard-finanzas.pdf'
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success(tFin('toast.executiveDashboardExported'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tFin('toast.executiveExportError'))
    } finally {
      setIsExporting(false)
    }
  }

  const kpisData = {
    totalIncome: data.summary.totalIncome,
    totalExpense: data.summary.totalExpense,
    balance: data.summary.balance,
    pendingIncome: data.summary.pendingIncome,
    pendingExpense: data.summary.pendingExpense,
    currentMonthIncome: data.summary.currentMonthIncome,
    currentMonthExpense: data.summary.currentMonthExpense,
    currentMonthNet: data.summary.currentMonthNet,
    unallocatedOverhead: data.overheadSummary.unallocated,
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

  const trendInteraction = useChartSeriesInteraction()
  const trendBalanceArea = trendInteraction.areaPresentation('Balance', 2.6, 0.12)
  const trendIngresosLine = trendInteraction.linePresentation('Ingresos', 1.5)
  const trendGastosLine = trendInteraction.linePresentation('Gastos', 1.5)

  const categoryRawSlices = useMemo(
    () =>
      data.expensesByCategory.map((c) => ({
        name: CATEGORY_LABELS[c.category] ?? c.category,
        value: c.total,
      })),
    [data.expensesByCategory]
  )

  const categoryDisplaySlices = useMemo(
    () => groupPieSlicesForDisplay(categoryRawSlices, 'Otros', 6, 5),
    [categoryRawSlices]
  )

  const categoryChartData = useMemo(
    () =>
      categoryDisplaySlices.map((s, i) => ({
        ...s,
        id: `p${i}`,
      })),
    [categoryDisplaySlices]
  )

  const categoryChartConfig = useMemo(() => {
    const c: ChartConfig = {}
    categoryDisplaySlices.forEach((s, i) => {
      c[`p${i}`] = { label: s.name, color: chartSeriesColor(i) }
    })
    return c
  }, [categoryDisplaySlices])

  const suppliersChartConfig = {
    total: { label: 'Total', color: 'hsl(var(--chart-3))' },
  } satisfies ChartConfig

  const projectsChartConfig = {
    total: { label: 'Total', color: 'hsl(var(--chart-4))' },
  } satisfies ChartConfig

  const suppliersChartData = data.topSuppliers.map((s) => ({
    name: s.supplierName.length > 20 ? s.supplierName.slice(0, 20) + '…' : s.supplierName,
    total: s.total,
  }))

  const projectsChartData = data.topProjectsByExpense.map((p) => ({
    name: p.projectNumber,
    total: p.total,
  }))

  const allAlerts = alerts.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    link: a.link ?? undefined,
    linkLabel: 'Ver detalle' as const,
    severity: a.severity,
  }))

  const alertClassName = cn(
    'flex gap-3 items-start py-3 px-3 rounded-lg border text-sm',
  )

  return (
    <div className="erp-stack">
      <CompanyFinanceKPICards data={kpisData} />

      {/* Fila: Alertas (mitad) | Gastos por categoría (mitad). Si no hay alertas, categoría a ancho completo. */}
      <div className={allAlerts.length > 0 ? 'grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2' : ''}>
        {allAlerts.length > 0 && (
          <div role="region" aria-label="Alertas" className="flex flex-col gap-4 min-w-0">
          {allAlerts.map((alert) => (
            <Alert
              key={alert.id}
              variant={alert.severity === 'danger' ? 'destructive' : 'default'}
              className={cn(
                alertClassName,
                alert.severity !== 'danger' &&
                  'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
              )}
            >
              {alert.severity === 'danger' ? (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
              )}
              <div className="flex-1 min-w-0 space-y-0.5">
                <AlertTitle className="mb-0 font-medium">{alert.title}</AlertTitle>
                <AlertDescription className="mt-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                  <span>{alert.message}</span>
                  {alert.link && (
                    <Link
                      href={alert.link}
                      className="text-sm font-medium text-primary hover:underline shrink-0"
                    >
                      {alert.linkLabel}
                    </Link>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          ))}
          </div>
        )}

        <div id="chart-category" className={allAlerts.length > 0 ? 'min-w-0' : ''}>
          <ChartCard title="Gastos por categoría" description="Distribución por tipo">
            <div className="h-[280px]">
              <ChartContainer
                config={categoryChartConfig}
                className="aspect-auto mx-auto h-[280px] w-full max-w-[320px]"
              >
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="id"
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill={CHART_PIE_PLACEHOLDER_FILL}
                  >
                    {categoryChartData.map((_, index) => (
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
        </div>
      </div>

      {/* Tendencia mensual: todo el ancho */}
      <div id="chart-trend">
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
              onMouseLeave={() => trendInteraction.setHoverKey(null)}
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
                content={
                  <ChartLegendContent
                    className="pt-4"
                    hiddenKeys={trendInteraction.hiddenKeys}
                    onLegendItemClick={trendInteraction.toggleKey}
                    onLegendItemHover={trendInteraction.setHoverKey}
                  />
                }
              />
              {trendBalanceArea ? (
                <Area
                  type="linear"
                  dataKey="Balance"
                  stroke="var(--color-Balance)"
                  fill="var(--color-Balance)"
                  dot={false}
                  {...trendBalanceArea}
                />
              ) : null}
              {trendIngresosLine ? (
                <Line
                  type="linear"
                  dataKey="Ingresos"
                  stroke="var(--color-Ingresos)"
                  dot={false}
                  {...trendIngresosLine}
                />
              ) : null}
              {trendGastosLine ? (
                <Line
                  type="linear"
                  dataKey="Gastos"
                  stroke="var(--color-Gastos)"
                  dot={false}
                  {...trendGastosLine}
                />
              ) : null}
            </ComposedChart>
          </ChartContainer>
        </div>
        </ChartCard>
      </div>

      {/* Top 5 proveedores y Top 5 proyectos: mitad cada uno, misma línea */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <div id="chart-suppliers" className="min-w-0">
          <ChartCard title="Top 5 proveedores por gasto" description="Últimos 12 meses">
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

        <div id="chart-projects" className="min-w-0">
          <ChartCard title="Top 5 proyectos por gasto" description="Últimos 12 meses">
            <div className="h-[260px]">
              <ChartContainer
                config={projectsChartConfig}
                className="aspect-auto h-[260px] min-h-[260px] w-full"
              >
                <BarChart
                  data={projectsChartData}
                  margin={{ top: 16, right: 18, left: 4, bottom: 8 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.4}
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="name"
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
                    content={
                      <ChartTooltipContent valueFormatter={(v) => valueFmt(Number(v))} />
                    }
                  />
                  <Bar
                    dataKey="total"
                    fill="var(--color-total)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {data.upcomingDue.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Próximos vencimientos (30 días)</CardTitle>
            <Badge variant="secondary">{data.upcomingDue.length}</Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.upcomingDue.map((payment) => {
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
                      <p className="text-sm text-muted-foreground">
                        {payment.supplier} • {payment.project}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="tabular-nums font-medium">
                        {formatCurrency(payment.amount, 'ARS')}
                      </span>
                      <Badge variant={daysUntilDue != null && daysUntilDue <= 0 ? 'danger' : 'secondary'}>
                        {dueDate ? formatDateShort(dueDate) : '—'}
                        {daysUntilDue != null && ` · ${daysUntilDue <= 0 ? 'Vencido' : `${daysUntilDue} días`}`}
                      </Badge>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleExportPDF} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exportando...' : 'Exportar Dashboard a PDF'}
        </Button>
      </div>
    </div>
  )
}
