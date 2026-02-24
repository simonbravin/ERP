'use client'

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
import type { ProgressVsCostRow } from '@/app/actions/predefined-reports'

interface Props {
  data: ProgressVsCostRow[]
}

export function ProgressVsCostReportClient({ data }: Props) {
  const chartData = data.slice(0, 12).map((p) => ({
    name: p.projectNumber,
    ConsumidoPct: p.consumedPct,
    AvancePct: p.progressPct ?? 0,
  }))

  return (
    <div className="space-y-6">
      <ChartCard
        title="Consumido vs Avance de obra por proyecto"
        description="Porcentaje de costo consumido vs porcentaje de avance físico (última fecha de avance)"
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(1)}%`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                }}
              />
              <Legend />
              <Bar
                dataKey="ConsumidoPct"
                name="Costo consumido %"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="AvancePct"
                name="Avance físico %"
                fill="hsl(var(--chart-3))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
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
                  <th className="pb-2 text-right font-medium">Presupuestado</th>
                  <th className="pb-2 text-right font-medium">Consumido</th>
                  <th className="pb-2 text-right font-medium">Consumido %</th>
                  <th className="pb-2 text-right font-medium">Avance %</th>
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
