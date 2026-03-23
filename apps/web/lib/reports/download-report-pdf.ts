import { toast } from 'sonner'

export type ReportPdfToastMessages = {
  success: string
  errorFallback: string
}

/** Download a predefined report PDF from `/api/pdf` (same params as `ReportExportPdfButton`). */
export async function downloadReportPdf(
  templateId: string,
  extraParams: Record<string, string> = {},
  messages: ReportPdfToastMessages
): Promise<void> {
  const locale =
    typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
  const params = new URLSearchParams({
    template: templateId,
    locale,
    showEmitidoPor: '1',
    showFullCompanyData: '1',
    ...extraParams,
  })
  const res = await fetch(`/api/pdf?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    toast.error(data?.error ?? messages.errorFallback)
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
  toast.success(messages.success)
}
