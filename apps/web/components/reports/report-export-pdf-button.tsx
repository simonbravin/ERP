'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import { downloadReportPdf } from '@/lib/reports/download-report-pdf'
import { toast } from 'sonner'

type ReportExportPdfButtonProps = {
  templateId: string
  /** Optional query params for the PDF (e.g. projectIds, showEmitidoPor, showFullCompanyData). */
  queryParams?: Record<string, string>
  label?: string
}

export function ReportExportPdfButton({
  templateId,
  queryParams = {},
  label,
}: ReportExportPdfButtonProps) {
  const t = useTranslations('common')
  const [isExporting, setIsExporting] = useState(false)
  const displayLabel = label ?? t('exportPdf')

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await downloadReportPdf(templateId, queryParams, {
        success: t('toast.pdfExportSuccess'),
        errorFallback: t('toast.pdfExportError'),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.pdfExportError'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="mr-2 h-4 w-4" />
      )}
      {isExporting ? t('exporting') : displayLabel}
    </Button>
  )
}
