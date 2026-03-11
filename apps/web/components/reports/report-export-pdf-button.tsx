'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
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
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const params = new URLSearchParams({
        template: templateId,
        locale,
        showEmitidoPor: '1',
        showFullCompanyData: '1',
        ...queryParams,
      })
      const url = `/api/pdf?${params.toString()}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Error al exportar PDF')
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `${templateId}.pdf`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success('PDF exportado correctamente')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al exportar PDF')
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
