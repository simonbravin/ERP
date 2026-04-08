'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChartCard } from '@/components/charts/chart-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/format-utils'
import { formatChartAxisCurrency } from '@/lib/chart-format'
import { ExportDropdown, type ExportFormat } from '@/components/list'
import { toast } from 'sonner'
import { downloadReportPdf } from '@/lib/reports/download-report-pdf'
import type { ExpensesBySupplierRow } from '@/app/actions/predefined-reports'

interface Props {
  data: ExpensesBySupplierRow[]
  /** Optional query params for PDF export (e.g. projectIds from URL). */
  pdfQueryParams?: Record<string, string>
}

const REPORT_LOCALE = 'es-AR'
const REPORT_CURRENCY = 'ARS'

const chartConfig = {
  Total: { label: 'Total', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig

function downloadCsv(data: ExpensesBySupplierRow[]) {
  const headers = ['Proveedor', 'Total Gastado', 'Transacciones', 'Proyectos', 'Promedio/Tx']
  const rows = data.map((s) => [
    s.supplierName.replace(/"/g, '""'),
    s.total.toFixed(2),
    String(s.count),
    String(s.projectCount),
    (s.total / s.count).toFixed(2),
  ])
  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gastos-por-proveedor-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const PDF_TEMPLATE = 'gastos-por-proveedor'

export function ExpensesBySupplierReportClient({ data, pdfQueryParams }: Props) {
  const tCommon = useTranslations('common')
  const [exporting, setExporting] = useState(false)
  const chartData = data.slice(0, 10).map((s) => ({
    name: s.supplierName.length > 20 ? s.supplierName.substring(0, 20) + '…' : s.supplierName,
    Total: s.total,
  }))

  const totalSpent = data.reduce((sum, s) => sum + s.total, 0)

  const axisCurrency = useMemo(
    () => (v: number) =>
      formatChartAxisCurrency(v, { locale: REPORT_LOCALE, currency: REPORT_CURRENCY }),
    []
  )

  const valueFmt = useMemo(
    () => (v: number) => formatCurrency(v, REPORT_CURRENCY, REPORT_LOCALE),
    []
  )

  async function handleExport(format: ExportFormat) {
    if (format === 'csv') {
      downloadCsv(data)
      return
    }
    if (format !== 'pdf') return
    {
      setExporting(true)
      try {
        await downloadReportPdf(PDF_TEMPLATE, pdfQueryParams ?? {}, {
          success: tCommon('toast.pdfExportSuccess'),
          errorFallback: tCommon('toast.pdfExportError'),
        })
      } catch {
        toast.error(tCommon('toast.pdfExportError'))
      } finally {
        setExporting(false)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportDropdown
          formats={['csv', 'pdf']}
          onExport={handleExport}
          isLoading={exporting}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Gastado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Proveedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Promedio por Proveedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(data.length === 0 ? 0 : totalSpent / data.length)}
            </p>
          </CardContent>
        </Card>
      </div>

      <ChartCard
        title="Top 10 proveedores por gasto"
        description="Total gastado por proveedor"
      >
        <div className="h-[320px]">
          <ChartContainer config={chartConfig} className="aspect-auto h-full w-full min-h-[280px]">
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ top: 16, right: 18, left: 6, bottom: 8 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.45}
                strokeDasharray="4 4"
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={axisCurrency}
              />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <ChartTooltip
                isAnimationActive={false}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
                content={
                  <ChartTooltipContent
                    valueFormatter={(v) => valueFmt(v)}
                    labelFormatter={(label) =>
                      typeof label === 'string' ? label : String(label ?? '')
                    }
                  />
                }
              />
              <Bar dataKey="Total" fill="var(--color-Total)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>Detalle completo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Todos los proveedores ordenados por total gastado
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium">Proveedor</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                  <th className="pb-2 text-right font-medium">Tx</th>
                  <th className="pb-2 text-right font-medium">Proyectos</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.supplierId} className="border-b">
                    <td className="py-2">{row.supplierName}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.count}</td>
                    <td className="py-2 text-right tabular-nums">{row.projectCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
