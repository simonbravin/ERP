'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Play, Eye } from 'lucide-react'
import type { CustomReportWithCreator } from '@/lib/types/reports'

interface CustomReportsListProps {
  reports: CustomReportWithCreator[]
}

export function CustomReportsList({ reports }: CustomReportsListProps) {
  const t = useTranslations('reports')

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Card key={report.id} className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{report.name}</h3>
                {report.description && (
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {report.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {report.category}
                  </Badge>
                  {report.isPublic && (
                    <Badge variant="secondary" className="text-xs">
                      Público
                    </Badge>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    por {report.createdBy?.fullName ?? '—'}
                  </span>
                  {report.lastRunAt && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Última ejecución:{' '}
                      {new Date(report.lastRunAt).toLocaleDateString('es-AR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/reports/${report.id}/run`}>
                  <Play className="mr-1.5 h-4 w-4" />
                  Ejecutar
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/reports/${report.id}`}>
                  <Eye className="mr-1.5 h-4 w-4" />
                  Ver
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
