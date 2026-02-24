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
import { TrendingUp, TrendingDown, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useChartExport } from '@/hooks/use-chart-export'
import { exportProjectDashboardToPDF } from '@/app/actions/export'
import type { ProjectDashboardData } from '@/app/actions/project-dashboard'

interface ProjectInfo {
  id: string
  name: string
  projectNumber: string
}

const COLORS = {
  budget: 'hsl(var(--chart-3))',
  actual: 'hsl(var(--chart-1))',
  variance: 'hsl(var(--chart-2))',
  income: 'hsl(var(--chart-1))',
  expense: 'hsl(var(--chart-2))',
}

interface Props {
  project: ProjectInfo
  data: ProjectDashboardData
}

export function ProjectDashboardClient({ project, data }: Props) {
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const { captureChart } = useChartExport()

  useMessageBus('FINANCE_TRANSACTION.CREATED', () => router.refresh())
  useMessageBus('FINANCE_TRANSACTION.UPDATED', () => router.refresh())
  useMessageBus('INVENTORY_MOVEMENT.CREATED', () => router.refresh())

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true)
    try {
      const [wbs, cashflow, certifications] = await Promise.all([
        captureChart('chart-wbs'),
        captureChart('chart-cashflow'),
        captureChart('chart-certifications'),
      ])
      if (!wbs || !cashflow || !certifications) {
        toast.error('No se pudieron capturar los gráficos')
        return
      }
      const result = await exportProjectDashboardToPDF(project.id, {
        wbs,
        cashflow,
        certifications,
      })
      if (result?.success && result.data && result.filename) {
        const link = document.createElement('a')
        link.href = `data:application/pdf;base64,${result.data}`
        link.download = result.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('PDF descargado')
      } else {
        toast.error('Error al generar el PDF')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al exportar el dashboard')
    } finally {
      setIsExporting(false)
    }
  }, [project.id, captureChart])

  const budgetUsagePct =
    data.budget.total === 0 ? 0 : (data.budget.spent / data.budget.total) * 100
  const isOverBudget = budgetUsagePct > 100

  const wbsChartData = data.expensesByWbs.slice(0, 5).map((w) => ({
    name: w.wbsCode,
    Presupuestado: w.budgeted,
    Real: w.actual,
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
