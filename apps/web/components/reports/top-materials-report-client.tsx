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
import { downloadReportPdf } from '@/lib/reports/download-report-pdf'
import { toast } from 'sonner'
import type { TopMaterialsRow } from '@/app/actions/predefined-reports'

const PDF_TEMPLATE = 'top-materials'

const REPORT_LOCALE = 'es-AR'
const REPORT_CURRENCY = 'ARS'

const chartConfig = {
  Costo: { label: 'Costo total', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig

interface Props {
  data: TopMaterialsRow[]
}

function downloadCsv(data: TopMaterialsRow[]) {
  const headers = ['Material', 'Unidad', 'Cantidad total', 'Costo unit. prom.', 'Costo total', 'Proyectos']
  const rows = data.map((r) => [
    r.materialName.replace(/"/g, '""'),
    r.unit.replace(/"/g, '""'),
    r.totalQuantity.toFixed(2),
    r.avgUnitCost.toFixed(2),
    r.totalCost.toFixed(2),
    String(r.projectCount),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `top-10-materiales-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function TopMaterialsReportClient({ data }: Props) {
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

  const chartData = data.map((m) => ({
    name:
      m.materialName.length > 25
        ? m.materialName.substring(0, 25) + '…'
        : m.materialName,
    Costo: m.totalCost,
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
        title="Top 10 materiales por costo total"
        description="Presupuestos aprobados, agrupado por descripción y unidad"
      >
        <div className="h-[360px]">
          <ChartContainer config={chartConfig} className="aspect-auto h-full w-full min-h-[320px]">
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
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
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
              <Bar dataKey="Costo" fill="var(--color-Costo)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de materiales</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cantidad total, costo unitario promedio y proyectos donde aparece
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium">Material</th>
                  <th className="pb-2 text-right font-medium">Unidad</th>
                  <th className="pb-2 text-right font-medium">Cantidad</th>
                  <th className="pb-2 text-right font-medium">Costo total</th>
                  <th className="pb-2 text-right font-medium">Proyectos</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={`${row.materialName}-${row.unit}`} className="border-b">
                    <td className="py-2">{row.materialName}</td>
                    <td className="py-2 text-right">{row.unit}</td>
                    <td className="py-2 text-right tabular-nums">
                      {row.totalQuantity.toFixed(2)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.totalCost)}
                    </td>
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
