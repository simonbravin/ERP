'use client'

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
import { ChartCard } from '@/components/charts/chart-card'
import { CompanyFinanceKPICards } from '@/components/finance/company-finance-kpi-cards'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import { useTranslations } from 'next-intl'
import { AlertCircle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { ProjectFinanceExecutiveDashboard } from '@/app/actions/finance'
import type { FinanceAlert } from '@/app/actions/finance'

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  EXPENSE: 'Gastos',
  PURCHASE: 'Compras',
  OVERHEAD: 'Generales',
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-3))',
]

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

  const trendChartData = data.monthlyTrend.map((m) => ({
    mes: new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' }).format(
      new Date(m.month + '-01')
    ),
    Ingresos: m.income,
    Gastos: m.expense,
    Balance: m.balance,
  }))

  const compositionChartData = data.expensesByType
    .filter((c) => c.total > 0)
    .map((c) => ({
      name: EXPENSE_TYPE_LABELS[c.type] ?? c.type,
      value: c.total,
    }))

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

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={t('chartExpenseComposition')}
          description={t('chartExpenseCompositionDesc')}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={compositionChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {compositionChartData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, 'ARS')} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={t('chartTopSuppliers')}
          description={t('chartTopSuppliersDesc')}
        >
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
