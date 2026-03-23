'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChartCard } from '@/components/charts/chart-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/format-utils'
import { ExportDropdown, type ExportFormat } from '@/components/list'
import { downloadReportPdf } from '@/lib/reports/download-report-pdf'
import { toast } from 'sonner'
import type { BudgetVsActualRow } from '@/app/actions/predefined-reports'

const PDF_TEMPLATE = 'budget-vs-actual'

interface Props {
  data: BudgetVsActualRow[]
}

function downloadCsv(data: BudgetVsActualRow[]) {
  const headers = ['Nº Proyecto', 'Proyecto', 'Presupuestado', 'Real', 'Variación', '%']
  const rows = data.map((r) => [
    r.projectNumber.replace(/"/g, '""'),
    r.projectName.replace(/"/g, '""'),
    r.budgeted.toFixed(2),
    r.actual.toFixed(2),
    r.variance.toFixed(2),
    r.variancePct.toFixed(1),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `presupuesto-vs-real-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function BudgetVsActualReportClient({ data }: Props) {
  const tCommon = useTranslations('common')
  const [exporting, setExporting] = useState(false)

  async function handleExport(format: ExportFormat) {
    if (format === 'csv') {
      downloadCsv(data)
      return
    }
    if (format !== 'pdf') return
    setExporting(true)
    try {
      await downloadReportPdf(PDF_TEMPLATE, {}, {
        success: tCommon('toast.pdfExportSuccess'),
        errorFallback: tCommon('toast.pdfExportError'),
      })
    } catch {
      toast.error(tCommon('toast.pdfExportError'))
    } finally {
      setExporting(false)
    }
  }

  const chartData = data.slice(0, 12).map((p) => ({
    name: p.projectNumber,
    Presupuestado: p.budgeted,
    Real: p.actual,
    Varianza: p.variance,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportDropdown
          formats={['csv', 'pdf']}
          onExport={handleExport}
          isLoading={exporting}
        />
      </div>
      <ChartCard
        title="Presupuesto vs Real por proyecto"
        description="Barras agrupadas: presupuestado vs gastado"
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <Legend />
              <Bar
                dataKey="Presupuestado"
                fill="hsl(var(--chart-3))"
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey="Real" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por proyecto</CardTitle>
          <p className="text-sm text-muted-foreground">
            Presupuesto aprobado vs gasto real (PAID)
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium">Proyecto</th>
                  <th className="pb-2 text-right font-medium">Presupuestado</th>
                  <th className="pb-2 text-right font-medium">Real</th>
                  <th className="pb-2 text-right font-medium">Varianza</th>
                  <th className="pb-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.projectId} className="border-b">
                    <td className="py-2">
                      <span className="font-medium">{row.projectNumber}</span>
                      <span className="ml-1 text-muted-foreground">
                        {row.projectName}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.budgeted)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.actual)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        row.variance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(row.variance)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        row.variancePct >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {row.variancePct.toFixed(1)}%
                    </td>
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
