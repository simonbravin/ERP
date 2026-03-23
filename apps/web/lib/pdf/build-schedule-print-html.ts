/**
 * HTML del cronograma para PDF (API `/api/pdf?template=schedule`).
 * Encabezado corporativo alineado con presupuesto/OC (`build-print-document-header-html`).
 * El API usa A4 horizontal (landscape) para acomodar la tabla de tareas.
 */

import { buildPrintDocumentHeaderHtml } from '@/lib/pdf/build-print-document-header-html'
import type { PrintDocumentLayout } from '@/lib/pdf/build-print-document-header-html'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type SchedulePrintLayoutData = PrintDocumentLayout

export type SchedulePrintRow = {
  code: string
  name: string
  startDate: string
  endDate: string
  duration: number
  progress: string
}

export type SchedulePrintPageData = {
  projectName: string
  projectNumber?: string | null
  scheduleName: string
  scheduleStatus: string
  dateRangeSubtitle?: string
  rows: SchedulePrintRow[]
}

export type SchedulePrintOptions = {
  showEmitidoPor?: boolean
  showFullCompanyData?: boolean
  locale?: string
}

function scheduleStrings(locale: string) {
  const en = locale.toLowerCase().startsWith('en')
  if (en) {
    return {
      docTitle: 'Schedule',
      plan: 'Plan',
      status: 'Status',
      colCode: 'Code',
      colActivity: 'Activity',
      colStart: 'Planned start',
      colEnd: 'Planned end',
      colDuration: 'Duration (working days)',
      colProgress: 'Progress %',
      emptyPeriod: 'No tasks in the selected period.',
    }
  }
  return {
    docTitle: 'Cronograma',
    plan: 'Plan',
    status: 'Estado',
    colCode: 'Código',
    colActivity: 'Actividad',
    colStart: 'Inicio',
    colEnd: 'Fin',
    colDuration: 'Duración (días laborables)',
    colProgress: 'Avance %',
    emptyPeriod: 'No hay tareas en el período seleccionado.',
  }
}

function scheduleStatusLabel(status: string, locale: string): string {
  const en = locale.toLowerCase().startsWith('en')
  if (en) {
    return (
      (
        { DRAFT: 'Draft', BASELINE: 'Baseline', APPROVED: 'Approved' } as Record<
          string,
          string
        >
      )[status] ?? status
    )
  }
  return (
    (
      {
        DRAFT: 'Borrador',
        BASELINE: 'Línea base',
        APPROVED: 'Aprobado',
      } as Record<string, string>
    )[status] ?? status
  )
}

export function buildSchedulePrintHtml(
  layout: SchedulePrintLayoutData,
  page: SchedulePrintPageData,
  options: SchedulePrintOptions = {}
): string {
  const { showEmitidoPor = true, showFullCompanyData = true, locale = 'es' } = options
  const L = scheduleStrings(locale)

  const projectLine =
    layout.orgName && page.projectName
      ? page.projectName + (page.projectNumber ? ` (${page.projectNumber})` : '')
      : null

  const headerHtml = buildPrintDocumentHeaderHtml(layout, {
    showFullCompanyData,
    showEmitidoPor,
    projectLine,
    projectLineSuffix: page.dateRangeSubtitle ?? undefined,
    folioLines: [
      `${L.plan}: ${page.scheduleName}`,
      `${L.status}: ${scheduleStatusLabel(page.scheduleStatus, locale)}`,
    ],
    locale,
  })

  const titleHtml = `<h2 style="font-size:1rem;font-weight:600;margin:0 0 0.75rem;">${esc(L.docTitle)}</h2>`

  const rowPadding = '0.2rem 0.5rem'
  const tableFontSize = '0.75rem'
  const rowsHtml = page.rows.map(
    (r) => `<tr>
  <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};">${esc(r.code)}</td>
  <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};">${esc(r.name)}</td>
  <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};">${esc(r.startDate)}</td>
  <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};">${esc(r.endDate)}</td>
  <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};text-align:right;">${r.duration}</td>
  <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};text-align:center;">${esc(r.progress)}</td>
</tr>`
  )

  const tableHtml = `
<table style="width:100%;border-collapse:collapse;">
  <thead>
    <tr>
      <th style="padding:${rowPadding};border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;font-size:${tableFontSize};text-align:left;">${esc(L.colCode)}</th>
      <th style="padding:${rowPadding};border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;font-size:${tableFontSize};text-align:left;">${esc(L.colActivity)}</th>
      <th style="padding:${rowPadding};border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;font-size:${tableFontSize};text-align:left;">${esc(L.colStart)}</th>
      <th style="padding:${rowPadding};border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;font-size:${tableFontSize};text-align:left;">${esc(L.colEnd)}</th>
      <th style="padding:${rowPadding};border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;font-size:${tableFontSize};text-align:right;">${esc(L.colDuration)}</th>
      <th style="padding:${rowPadding};border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;font-size:${tableFontSize};text-align:center;">${esc(L.colProgress)}</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml.join('')}
  </tbody>
</table>`

  const htmlLang = locale.toLowerCase().startsWith('en') ? 'en' : 'es'

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8" />
  <title>${esc(L.docTitle)}</title>
</head>
<body style="margin:0;padding:1rem;font-family:system-ui,sans-serif;color:#0f172a;">
  ${headerHtml}
  ${titleHtml}
  ${page.rows.length === 0 && page.dateRangeSubtitle ? `<p style="font-size:0.875rem;color:#64748b;">${esc(L.emptyPeriod)}</p>` : ''}
  ${page.rows.length > 0 ? tableHtml : ''}
</body>
</html>`
}
