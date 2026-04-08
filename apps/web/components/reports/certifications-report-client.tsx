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
import type { CertificationsByProjectRow } from '@/app/actions/predefined-reports'

const PDF_TEMPLATE = 'certifications-report'

const REPORT_LOCALE = 'es-AR'
const REPORT_CURRENCY = 'ARS'

const chartConfig = {
  Borrador: { label: 'Borrador', color: 'hsl(var(--chart-4))' },
  Emitida: { label: 'Emitida', color: 'hsl(var(--chart-3))' },
  Aprobada: { label: 'Aprobada', color: 'hsl(var(--chart-1))' },
  Rechazada: { label: 'Rechazada', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

interface Props {
  data: CertificationsByProjectRow[]
}

function downloadCsv(data: CertificationsByProjectRow[]) {
  const headers = ['Nº Proyecto', 'Proyecto', 'Total certificado', 'Borrador', 'Emitida', 'Aprobada', 'Rechazada', 'Certificados']
  const rows = data.map((r) => [
    r.projectNumber.replace(/"/g, '""'),
    r.projectName.replace(/"/g, '""'),
    r.totalCertified.toFixed(2),
    r.draft.toFixed(2),
    r.issued.toFixed(2),
    r.approved.toFixed(2),
    r.rejected.toFixed(2),
    String(r.count),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `certificaciones-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function CertificationsReportClient({ data }: Props) {
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
    Borrador: p.draft,
    Emitida: p.issued,
    Aprobada: p.approved,
    Rechazada: p.rejected,
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
        title="Certificaciones por proyecto (apilado)"
        description="Montos por estado: Borrador, Emitida, Aprobada, Rechazada"
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
              <Bar dataKey="Borrador" stackId="a" fill="var(--color-Borrador)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Emitida" stackId="a" fill="var(--color-Emitida)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Aprobada" stackId="a" fill="var(--color-Aprobada)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Rechazada" stackId="a" fill="var(--color-Rechazada)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por proyecto</CardTitle>
          <p className="text-sm text-muted-foreground">
            Monto certificado por estado y cantidad de certificaciones
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium">Proyecto</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                  <th className="pb-2 text-right font-medium">Borrador</th>
                  <th className="pb-2 text-right font-medium">Emitida</th>
                  <th className="pb-2 text-right font-medium">Aprobada</th>
                  <th className="pb-2 text-right font-medium">Rechazada</th>
                  <th className="pb-2 text-right font-medium">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.projectId} className="border-b">
                    <td className="py-2">
                      <span className="font-medium">{row.projectNumber}</span>
                      <span className="ml-1 text-muted-foreground">{row.projectName}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.totalCertified)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.draft)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.issued)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.approved)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.rejected)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.count}</td>
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
