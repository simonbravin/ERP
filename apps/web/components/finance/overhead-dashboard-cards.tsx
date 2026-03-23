'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrencyForDisplay } from '@/lib/format-utils'
import { DollarSign, CheckCircle, AlertCircle, Percent } from 'lucide-react'

export type OverheadDashboardData = {
  totalOverhead: number
  totalAllocated: number
  unallocated: number
  unallocatedTransactions: number
  partiallyAllocated: number
  topProjects: Array<{
    projectId: string
    projectName: string
    projectNumber: string
    totalOverhead: number
  }>
}

interface Props {
  data: OverheadDashboardData
}

export function OverheadDashboardCards({ data }: Props) {
  const allocationPct =
    data.totalOverhead === 0 ? 0 : (data.totalAllocated / data.totalOverhead) * 100

  const kpis = [
    {
      title: 'Total Generales',
      value: data.totalOverhead,
      format: 'currency' as const,
      description: 'Gastos generales del período',
      icon: DollarSign,
    },
    {
      title: 'Asignado',
      value: data.totalAllocated,
      format: 'currency' as const,
      description: `${allocationPct.toFixed(1)}% del total`,
      icon: CheckCircle,
    },
    {
      title: 'Sin Asignar',
      value: data.unallocated,
      format: 'currency' as const,
      description: `${data.unallocatedTransactions + data.partiallyAllocated} transacción(es)`,
      icon: AlertCircle,
    },
    {
      title: '% Asignado',
      value: allocationPct.toFixed(1),
      format: 'percent' as const,
      description: 'Del total de generales',
      icon: Percent,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold tabular-nums erp-kpi-value min-w-0">
                {kpi.format === 'currency' ? formatCurrencyForDisplay(kpi.value, 'ARS') : `${kpi.value}%`}
              </div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.topProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Proyectos con gastos generales asignados</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.topProjects.map((project) => (
                <li
                  key={project.projectId}
                  className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2"
                >
                  <div>
                    <span className="font-medium text-foreground">{project.projectName}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {project.projectNumber}
                    </span>
                  </div>
                  <div className="text-right tabular-nums erp-kpi-value min-w-0">
                    <span className="font-semibold">{formatCurrencyForDisplay(project.totalOverhead, 'ARS')}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {data.totalAllocated > 0
                        ? `${((project.totalOverhead / data.totalAllocated) * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
