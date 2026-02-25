'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { ChartCard } from '@/components/charts/chart-card'
import { CompanyFinanceKPICards } from '@/components/finance/company-finance-kpi-cards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import { Download, AlertTriangle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import type { FinanceExecutiveDashboard, FinanceAlert } from '@/app/actions/finance'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-3))',
]

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
  const [isExporting, setIsExporting] = useState(false)
  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const url = `/api/pdf?template=finance-dashboard&locale=${encodeURIComponent(locale)}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Error al exportar')
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
      toast.success('Dashboard exportado correctamente')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al exportar')
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

  const trendChartData = data.monthlyTrend.map((m) => ({
    mes: new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' }).format(
      new Date(m.month + '-01')
    ),
    Ingresos: m.income,
    Gastos: m.expense,
    Balance: m.balance,
  }))

  const categoryChartData = data.expensesByCategory.map((c) => ({
    name: CATEGORY_LABELS[c.category] ?? c.category,
    value: c.total,
  }))

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
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryChartData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, 'ARS')} />
                </PieChart>
              </ResponsiveContainer>
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
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, 'ARS')}
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
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="Gastos"
                stackId="2"
                stroke="hsl(var(--chart-2))"
                fill="hsl(var(--chart-2))"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        </ChartCard>
      </div>

      {/* Top 5 proveedores y Top 5 proyectos: mitad cada uno, misma línea */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <div id="chart-suppliers" className="min-w-0">
          <ChartCard title="Top 5 proveedores por gasto" description="Últimos 12 meses">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={suppliersChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value, 'ARS')} />
                  <Bar dataKey="total" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div id="chart-projects" className="min-w-0">
          <ChartCard title="Top 5 proyectos por gasto" description="Últimos 12 meses">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={projectsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value, 'ARS')} />
                  <Bar dataKey="total" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
