'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/format-utils'
import type { CashflowBreakdownItem } from '@/app/actions/finance'
import { CHART_PIE_PLACEHOLDER_FILL, chartSeriesColor } from '@/lib/chart-theme'

interface Props {
  breakdown: CashflowBreakdownItem[]
}

export function CashflowBreakdownChart({ breakdown }: Props) {
  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Composición de Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground py-8">
            No hay gastos en el período seleccionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalExpenses = breakdown.reduce((sum, i) => sum + i.totalExpense, 0)
  const chartData = breakdown.map((item, index) => ({
    name:
      item.projectId === null
        ? 'Generales'
        : `${item.projectNumber} - ${item.projectName.substring(0, 20)}${item.projectName.length > 20 ? '...' : ''}`,
    value: item.totalExpense,
    fill: chartSeriesColor(index),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composición de Gastos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill={CHART_PIE_PLACEHOLDER_FILL}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, 'ARS')} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Proyecto / Generales
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                    Gasto Total
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((item) => {
                  const percentage = totalExpenses > 0 ? (item.totalExpense / totalExpenses) * 100 : 0
                  return (
                    <tr key={item.projectId ?? 'overhead'} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        {item.projectId === null ? (
                          'Generales'
                        ) : (
                          <span>
                            {item.projectNumber} {item.projectName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatCurrency(item.totalExpense, 'ARS')}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {percentage.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
