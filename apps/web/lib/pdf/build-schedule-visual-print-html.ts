import { buildPrintDocumentHeaderHtml } from '@/lib/pdf/build-print-document-header-html'
import type { PrintDocumentLayout } from '@/lib/pdf/build-print-document-header-html'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type ScheduleVisualTask = {
  code: string
  name: string
  startDate: Date
  endDate: Date
  progressPercent: number
  taskType: 'TASK' | 'SUMMARY' | 'MILESTONE'
  isCritical: boolean
}

export type ScheduleVisualPrintData = {
  projectName: string
  projectNumber?: string | null
  scheduleName: string
  scheduleStatus: string
  fromDate: Date
  toDate: Date
  tasks: ScheduleVisualTask[]
}

export type ScheduleVisualPrintOptions = {
  locale?: string
  showEmitidoPor?: boolean
  showFullCompanyData?: boolean
}

function strings(locale: string) {
  const en = locale.toLowerCase().startsWith('en')
  return en
    ? {
        title: 'Schedule View (Gantt)',
        status: 'Status',
        plan: 'Plan',
        codeTask: 'Code / Task',
        timeline: 'Timeline',
      }
    : {
        title: 'Vista de Cronograma (Gantt)',
        status: 'Estado',
        plan: 'Plan',
        codeTask: 'Código / Tarea',
        timeline: 'Línea de tiempo',
      }
}

function statusLabel(status: string, locale: string): string {
  const en = locale.toLowerCase().startsWith('en')
  if (en) return ({ DRAFT: 'Draft', BASELINE: 'Baseline', APPROVED: 'Approved' } as Record<string, string>)[status] ?? status
  return ({ DRAFT: 'Borrador', BASELINE: 'Línea base', APPROVED: 'Aprobado' } as Record<string, string>)[status] ?? status
}

export function buildScheduleVisualPrintHtml(
  layout: PrintDocumentLayout,
  page: ScheduleVisualPrintData,
  options: ScheduleVisualPrintOptions = {}
): string {
  const locale = options.locale ?? 'es'
  const L = strings(locale)
  const totalMs = Math.max(page.toDate.getTime() - page.fromDate.getTime(), 1)

  const headerHtml = buildPrintDocumentHeaderHtml(layout, {
    showFullCompanyData: options.showFullCompanyData ?? true,
    showEmitidoPor: options.showEmitidoPor ?? true,
    projectLine:
      page.projectName + (page.projectNumber ? ` (${page.projectNumber})` : ''),
    folioLines: [
      `${L.plan}: ${page.scheduleName}`,
      `${L.status}: ${statusLabel(page.scheduleStatus, locale)}`,
    ],
    locale,
  })

  const rowsHtml = page.tasks
    .map((t) => {
      const taskStart = Math.max(t.startDate.getTime(), page.fromDate.getTime())
      const taskEnd = Math.min(t.endDate.getTime(), page.toDate.getTime())
      const leftPct = ((taskStart - page.fromDate.getTime()) / totalMs) * 100
      const widthPct = Math.max(((taskEnd - taskStart) / totalMs) * 100, 0.7)
      const color = t.taskType === 'SUMMARY' ? '#06b6d4' : t.taskType === 'MILESTONE' ? '#f59e0b' : t.isCritical ? '#ef4444' : '#3b82f6'
      const progressWidth = Math.max(Math.min(t.progressPercent, 100), 0)
      return `<tr>
  <td style="padding:6px;border:1px solid #e2e8f0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px;">${esc(t.code)} ${esc(t.name)}</td>
  <td style="padding:6px;border:1px solid #e2e8f0;">
    <div style="position:relative;height:16px;background:#f1f5f9;border-radius:3px;">
      <div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:16px;background:${color};border-radius:3px;opacity:0.9;"></div>
      ${
        t.taskType === 'TASK'
          ? `<div style="position:absolute;left:${leftPct}%;width:${(widthPct * progressWidth) / 100}%;height:16px;background:#1e3a8a;border-radius:3px;opacity:0.95;"></div>`
          : ''
      }
    </div>
  </td>
</tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="${locale.toLowerCase().startsWith('en') ? 'en' : 'es'}">
<head>
  <meta charset="utf-8" />
  <title>${esc(L.title)}</title>
</head>
<body style="margin:0;padding:12px;font-family:system-ui,sans-serif;color:#0f172a;">
  ${headerHtml}
  <h2 style="font-size:16px;margin:0 0 10px;">${esc(L.title)}</h2>
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    <thead>
      <tr>
        <th style="padding:6px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;width:34%;">${esc(L.codeTask)}</th>
        <th style="padding:6px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">${esc(L.timeline)}</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`
}
