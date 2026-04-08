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
import { ExportDropdown, type ExportFormat } from '@/components/list'
import { downloadReportPdf } from '@/lib/reports/download-report-pdf'
import { toast } from 'sonner'
import type { ProgressVsCostRow } from '@/app/actions/predefined-reports'

const PDF_TEMPLATE = 'progress-vs-cost'

const chartConfig = {
  ConsumidoPct: { label: 'Costo consumido %', color: 'hsl(var(--chart-1))' },
  AvancePct: { label: 'Avance físico %', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig

interface Props {
  data: ProgressVsCostRow[]
}

function downloadCsv(data: ProgressVsCostRow[]) {
  const headers = ['Nº Proyecto', 'Proyecto', 'Presupuestado', 'Consumido', '% Consumido', '% Avance']
  const rows = data.map((r) => [
    r.projectNumber.replace(/"/g, '""'),
    r.projectName.replace(/"/g, '""'),
    r.budgeted.toFixed(2),
    r.consumed.toFixed(2),
    r.consumedPct.toFixed(1),
    r.progressPct != null ? r.progressPct.toFixed(1) : '',
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `avance-vs-costo-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ProgressVsCostReportClient({ data }: Props) {
  const tCommon = useTranslations('common')
  const [exporting, setExporting] = useState(false)

  const pctFmt = useMemo(
    () => (v: number) => `${v.toFixed(1)}%`,
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
    ConsumidoPct: p.consumedPct,
    AvancePct: p.progressPct ?? 0,
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
        title="Consumido vs Avance de obra por proyecto"
        description="Porcentaje de costo consumido vs porcentaje de avance físico (última fecha de avance)"
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
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <ChartTooltip
                isAnimationActive={false}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
                content={
                  <ChartTooltipContent
                    valueFormatter={(v) => pctFmt(v)}
                    labelFormatter={(label) =>
                      typeof label === 'string' ? label : String(label ?? '')
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="ConsumidoPct"
                fill="var(--color-ConsumidoPct)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="AvancePct"
                fill="var(--color-AvancePct)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por proyecto</CardTitle>
          <p className="text-sm text-muted-foreground">
            Presupuesto, gasto consumido y avance físico (última fecha de avance)
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium">Proyecto</th>
                  <th className="pb-2 text-right font-medium">Presup.</th>
                  <th className="pb-2 text-right font-medium">Consumido</th>
                  <th className="pb-2 text-right font-medium">% Cons.</th>
                  <th className="pb-2 text-right font-medium">% Avance</th>
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
                      {formatCurrency(row.budgeted)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(row.consumed)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.consumedPct.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.progressPct != null ? `${row.progressPct.toFixed(1)}%` : '—'}
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
