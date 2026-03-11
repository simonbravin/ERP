'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { runSavedReport } from '@/app/actions/reports'
import { ExportDropdown, type ExportFormat } from '@/components/list'
import { toast } from 'sonner'

type ReportRunClientProps = {
  reportId: string
  reportName: string
}

export function ReportRunClient({
  reportId,
  reportName,
}: ReportRunClientProps) {
  const router = useRouter()
  const t = useTranslations('reports')
  const [running, setRunning] = useState(false)

  async function handleExport(format: ExportFormat) {
    if (format !== 'excel' && format !== 'csv') return
    setRunning(true)
    try {
      const apiFormat = format === 'excel' ? 'EXCEL' : 'CSV'
      await runSavedReport(reportId, apiFormat)
      window.open(`/api/reports/${reportId}/export?format=${apiFormat}`, '_blank')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast.error(message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {t('exportReportHint', { name: reportName })}
      </p>
      <ExportDropdown
        formats={['excel', 'csv']}
        onExport={handleExport}
        isLoading={running}
      />
    </div>
  )
}
