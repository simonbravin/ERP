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
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/format-utils'
import { formatChartAxisCurrency } from '@/lib/chart-format'
import { ExportDropdown, type ExportFormat } from '@/components/list'
import { downloadReportPdf } from '@/lib/reports/download-report-pdf'
import { toast } from 'sonner'
import type { BudgetVsActualRow } from '@/app/actions/predefined-reports'

const PDF_TEMPLATE = 'budget-vs-actual'

const REPORT_LOCALE = 'es-AR'
const REPORT_CURRENCY = 'ARS'

const chartConfig = {
  Presupuestado: { label: 'Presupuestado', color: 'hsl(var(--chart-3))' },
  Real: { label: 'Real', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

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
          <ChartContainer config={chartConfig} className="aspect-auto h-full w-full min-h-[320px]">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 16, right: 18, left: 6, bottom: 8 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.45}
                strokeDasharray="4 4"
              />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={axisCurrency}
              />
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
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="Presupuestado"
                fill="var(--color-Presupuestado)"
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey="Real" fill="var(--color-Real)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
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
