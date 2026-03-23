'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMessageBus } from '@/hooks/use-message-bus'
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
  Cell,
} from 'recharts'
import { ChartCard } from '@/components/charts/chart-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/format-utils'
import { TrendingUp, TrendingDown, AlertTriangle, Download, CalendarClock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import type { ProjectDashboardData } from '@/app/actions/project-dashboard'
import type { ProjectDashboardCrossAlert } from '@/app/actions/project-dashboard'

interface ProjectInfo {
  id: string
  name: string
  projectNumber: string
}

const COLORS = {
  budget: 'hsl(var(--chart-3))',
  actual: 'hsl(var(--chart-1))',
  committed: 'hsl(var(--chart-4))',
  variance: 'hsl(var(--chart-2))',
  income: 'hsl(var(--chart-1))',
  expense: 'hsl(var(--chart-2))',
}

interface Props {
  project: ProjectInfo
  data: ProjectDashboardData
}

function formatRatio(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

function alertMessage(
  t: (key: string, values?: Record<string, string>) => string,
  a: ProjectDashboardCrossAlert
) {
  if (a.kind === 'delay_and_cost' && a.overspendPct != null) {
    return t('projectDashboardAlertDelayAndCost', {
      code: a.wbsCode,
      name: a.wbsName,
      pct: a.overspendPct.toFixed(1),
    })
  }
  if (a.kind === 'schedule_delay') {
    return t('projectDashboardAlertScheduleDelay', { code: a.wbsCode, name: a.wbsName })
  }
  if (a.kind === 'wbs_cost_overrun' && a.overspendPct != null) {
    return t('projectDashboardAlertCostOverrun', {
      code: a.wbsCode,
      name: a.wbsName,
      pct: a.overspendPct.toFixed(1),
    })
  }
  return `${a.wbsCode} — ${a.wbsName}`
}

export function ProjectDashboardClient({ project, data }: Props) {
  const tProjects = useTranslations('projects')
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)

  useMessageBus('FINANCE_TRANSACTION.CREATED', () => router.refresh())
  useMessageBus('FINANCE_TRANSACTION.UPDATED', () => router.refresh())
  useMessageBus('INVENTORY_MOVEMENT.CREATED', () => router.refresh())

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true)
    try {
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const url = `/api/pdf?template=project-dashboard&id=${encodeURIComponent(project.id)}&locale=${encodeURIComponent(locale)}&showEmitidoPor=1&showFullCompanyData=1`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? tProjects('toast.dashboardPdfGenerateError'))
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `dashboard-proyecto-${project.id}.pdf`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success(tProjects('toast.dashboardPdfOk'))
    } catch (err) {
      console.error(err)
      toast.error(tProjects('toast.dashboardPdfError'))
    } finally {
      setIsExporting(false)
    }
  }, [project.id, tProjects])

  const budgetUsagePct =
    data.budget.total === 0 ? 0 : (data.budget.spent / data.budget.total) * 100
  const isOverBudget = budgetUsagePct > 100

  const wbsChartData = data.expensesByWbs.slice(0, 5).map((w) => ({
    name: w.wbsCode,
    Presupuestado: w.budgeted,
    Real: w.actual,
    Comprometido: w.committed,
    Varianza: w.variance,
  }))

  const cashflowChartData = data.cashflow.map((m) => ({
    mes: new Intl.DateTimeFormat('es', { month: 'short' }).format(
      new Date(m.month + '-01')
    ),
    Ingresos: m.income,
    Gastos: m.expense,
    Balance: m.balance,
  }))

  const certChartData = data.certifications.data.map((c) => ({
    name: `Cert ${c.number}`,
    Monto: c.amount,
    fill:
      c.status === 'APPROVED'
        ? COLORS.actual
        : c.status === 'ISSUED'
          ? 'hsl(var(--chart-3))'
          : 'hsl(var(--chart-4))',
  }))

  return (
    <div className="space-y-6">
      {/* KPIs de Presupuesto */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Presupuesto Total
            </CardTitle>
            <Badge variant="secondary">Aprobado</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(data.budget.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gastado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(data.budget.spent)}
            </p>
            <p className="text-xs text-muted-foreground">
              {budgetUsagePct.toFixed(1)}% usado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comprometido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(data.budget.committed)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.budget.commitmentRatio.toFixed(1)}% del presupuesto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Varianza
              {data.budget.variance >= 0 ? (
                <TrendingUp className="ml-1 inline h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="ml-1 inline h-4 w-4 text-red-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={
                data.budget.variance >= 0 ? 'text-green-600' : 'text-red-600'
              }
            >
              {formatCurrency(Math.abs(data.budget.variance))}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.budget.variance >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'} (
              {Math.abs(data.budget.variancePct).toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tProjects('projectDashboardEvmTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{tProjects('projectDashboardEvmSubtitle')}</p>
          {!data.evm.hasSchedule && (
            <p className="text-sm text-amber-700 dark:text-amber-500">
              {tProjects('projectDashboardEvmNoSchedule')}
            </p>
          )}
          {data.evm.hasSchedule && data.evm.scheduleName && (
            <p className="text-sm text-muted-foreground">
              {tProjects('projectDashboardEvmScheduleLabel', { name: data.evm.scheduleName })}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmBac')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(data.evm.bac)}</p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmEv')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(data.evm.ev)}</p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmAc')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(data.evm.ac)}</p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmPv')}</p>
              <p className="text-lg font-semibold tabular-nums">
                {data.evm.pv != null ? formatCurrency(data.evm.pv) : tProjects('projectDashboardEvmNa')}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmPhysicalPct')}</p>
              <p className="text-lg font-semibold tabular-nums">
                {data.evm.taskCount === 0
                  ? tProjects('projectDashboardEvmNa')
                  : `${data.evm.physicalProgressPct.toFixed(1)}%`}
              </p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmCpi')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatRatio(data.evm.cpi)}</p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmSpi')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatRatio(data.evm.spi)}</p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmCv')}</p>
              <p
                className={`text-lg font-semibold tabular-nums ${data.evm.cv >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatCurrency(data.evm.cv)}
              </p>
            </div>
          </div>
          {data.evm.sv != null && (
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tProjects('projectDashboardEvmSv')}</p>
              <p
                className={`text-lg font-semibold tabular-nums ${data.evm.sv >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatCurrency(data.evm.sv)}
              </p>
            </div>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${project.id}/schedule`} className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              {tProjects('projectDashboardOpenSchedule')}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {data.crossAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {tProjects('projectDashboardAlertsTitle')}
          </h3>
          {data.crossAlerts.map((a, i) => (
            <Alert
              key={`${a.kind}-${a.wbsCode}-${i}`}
              variant={a.kind === 'delay_and_cost' ? 'destructive' : 'default'}
              className={
                a.kind === 'wbs_cost_overrun'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                  : undefined
              }
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">{a.wbsCode}</AlertTitle>
              <AlertDescription>{alertMessage(tProjects, a)}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {isOverBudget && (
        <Alert
          variant="destructive"
          className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500" />
          <AlertTitle>Proyecto sobre presupuesto</AlertTitle>
          <AlertDescription>
            Has excedido el presupuesto aprobado en{' '}
            {formatCurrency(Math.abs(data.budget.variance))}
          </AlertDescription>
        </Alert>
      )}

      {/* Fila 1: Presupuesto vs Real por Partida + Cashflow */}
      <div className="grid min-h-[320px] gap-6 lg:grid-cols-2">
        <div id="chart-wbs">
          <ChartCard
            title="Presupuesto vs Real por partida (Top 5)"
            description="WBS con mayor gasto real"
          >
            <div className="h-[280px] min-h-[280px] w-full min-w-0" style={{ minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={wbsChartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                />
                <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                  }}
                />
                <Legend />
                <Bar dataKey="Presupuestado" fill={COLORS.budget} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Real" fill={COLORS.actual} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Comprometido" fill={COLORS.committed} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          </ChartCard>
        </div>

        <div id="chart-cashflow">
          <ChartCard
            title="Cashflow del proyecto (últimos 6 meses)"
            description="Ingresos vs gastos por mes"
          >
            <div className="h-[280px] min-h-[280px] w-full min-w-0" style={{ minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={cashflowChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Ingresos"
                  stackId="1"
                  stroke={COLORS.income}
                  fill={COLORS.income}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="Gastos"
                  stackId="2"
                  stroke={COLORS.expense}
                  fill={COLORS.expense}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Fila 2: Certificaciones + Top Proveedores */}
      <div className="grid min-h-[320px] gap-6 lg:grid-cols-2">
        <ChartCard
          title="Evolución de certificaciones"
          description="Monto por certificación"
        >
          <div className="h-[280px] min-h-[280px] w-full min-w-0" style={{ minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={certChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                  }}
                />
                <Bar dataKey="Monto" radius={[4, 4, 0, 0]}>
                  {certChartData.map((_, index) => (
                    <Cell key={index} fill={certChartData[index].fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </ChartCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Proveedores</CardTitle>
            <p className="text-sm text-muted-foreground">
              Gastos del proyecto por proveedor
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.expensesBySupplier.map((supplier) => (
                <li
                  key={supplier.supplierId}
                  className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{supplier.supplierName}</p>
                    <p className="text-xs text-muted-foreground">
                      {supplier.count} transacción(es)
                    </p>
                  </div>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(supplier.total)}
                  </span>
                </li>
              ))}
              {data.expensesBySupplier.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sin gastos por proveedor
                </p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleExportPDF} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exportando...' : 'Exportar Dashboard a PDF'}
        </Button>
      </div>
    </div>
  )
}
