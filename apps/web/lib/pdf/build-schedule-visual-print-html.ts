import { addDays } from 'date-fns'
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
        title: 'Schedule — Gantt (landscape)',
        status: 'Status',
        plan: 'Plan',
        period: 'Exported period',
        codeTask: 'Code / Task',
        timeline: 'Timeline',
        emptyPeriod: 'No tasks overlap the selected period.',
      }
    : {
        title: 'Cronograma — Gantt (apaisado)',
        status: 'Estado',
        plan: 'Plan',
        period: 'Período exportado',
        codeTask: 'Código / Tarea',
        timeline: 'Línea de tiempo',
        emptyPeriod: 'Ninguna tarea intersecta el período elegido.',
      }
}

function statusLabel(status: string, locale: string): string {
  const en = locale.toLowerCase().startsWith('en')
  if (en) return ({ DRAFT: 'Draft', BASELINE: 'Baseline', APPROVED: 'Approved' } as Record<string, string>)[status] ?? status
  return ({ DRAFT: 'Borrador', BASELINE: 'Línea base', APPROVED: 'Aprobado' } as Record<string, string>)[status] ?? status
}

function formatRangeLine(from: Date, to: Date, locale: string): string {
  const loc = locale.toLowerCase().startsWith('en') ? 'en-GB' : 'es-AR'
  const opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
  return `${from.toLocaleDateString(loc, opts)} — ${to.toLocaleDateString(loc, opts)}`
}

function buildTimelineTicks(from: Date, to: Date, locale: string): { label: string; pct: number }[] {
  const loc = locale.toLowerCase().startsWith('en') ? 'en-GB' : 'es-AR'
  const totalMs = Math.max(to.getTime() - from.getTime(), 1)
  const daySpan = totalMs / 86400000
  let stepDays = 7
  if (daySpan > 540) stepDays = 91
  else if (daySpan > 200) stepDays = 31
  else if (daySpan > 100) stepDays = 14
  else if (daySpan > 35) stepDays = 7
  else stepDays = Math.max(1, Math.ceil(daySpan / 6))

  const labelOpts: Intl.DateTimeFormatOptions =
    daySpan > 200 ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' }

  const ticks: { label: string; pct: number }[] = []
  let cur = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let guard = 0
  while (cur.getTime() <= to.getTime() && guard < 80) {
    const pct = ((cur.getTime() - from.getTime()) / totalMs) * 100
    if (pct >= -1 && pct <= 101) {
      ticks.push({
        label: cur.toLocaleDateString(loc, labelOpts),
        pct: Math.min(100, Math.max(0, pct)),
      })
    }
    cur = addDays(cur, stepDays)
    guard++
  }
  const last = ticks[ticks.length - 1]
  if (!last || last.pct < 98) {
    ticks.push({
      label: to.toLocaleDateString(loc, labelOpts),
      pct: 100,
    })
  }
  return ticks
}

function renderTaskBar(
  t: ScheduleVisualTask,
  fromMs: number,
  toMs: number,
  totalMs: number
): string {
  const rangeEnd = toMs
  const rangeStart = fromMs
  const taskStart = Math.max(t.startDate.getTime(), rangeStart)
  const taskEnd = Math.min(t.endDate.getTime(), rangeEnd)
  const color =
    t.taskType === 'SUMMARY'
      ? '#06b6d4'
      : t.taskType === 'MILESTONE'
        ? '#f59e0b'
        : t.isCritical
          ? '#ef4444'
          : '#3b82f6'

  const isMilestone =
    t.taskType === 'MILESTONE' || taskEnd - taskStart < 36e5

  if (totalMs <= 0) {
    return `<div style="position:relative;height:20px;background:#e2e8f0;border-radius:4px;overflow:hidden;"></div>`
  }

  const leftPct = ((taskStart - rangeStart) / totalMs) * 100
  const rawWidthPct = ((taskEnd - taskStart) / totalMs) * 100

  if (isMilestone) {
    const mid = (Math.min(t.endDate.getTime(), rangeEnd) + Math.max(t.startDate.getTime(), rangeStart)) / 2
    let centerPct = ((mid - rangeStart) / totalMs) * 100
    centerPct = Math.min(100, Math.max(0, centerPct))
    return `<div style="position:relative;height:20px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
      <div style="position:absolute;left:${centerPct}%;top:50%;width:12px;height:12px;background:${color};transform:translate(-50%,-50%) rotate(45deg);border-radius:1px;box-shadow:0 0 0 1px rgba(15,23,42,0.12);"></div>
    </div>`
  }

  const leftClamped = Math.min(100, Math.max(0, leftPct))
  const rightEdge = leftPct + rawWidthPct
  const widthPct = Math.max(Math.min(rightEdge, 100) - leftClamped, 0.55)

  const progressWidth = Math.max(Math.min(t.progressPercent, 100), 0)
  const barInner =
    t.taskType === 'TASK'
      ? `<div style="position:absolute;left:0;top:0;bottom:0;width:${progressWidth}%;background:rgba(30,58,138,0.92);pointer-events:none;"></div>`
      : ''

  return `<div style="position:relative;height:20px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
    <div style="position:absolute;left:${leftClamped}%;width:${widthPct}%;top:0;bottom:0;background:${color};border-radius:3px;opacity:0.92;">
      ${barInner}
    </div>
  </div>`
}

/**
 * HTML tipo Gantt para PDF (A4 apaisado vía `render-pdf` + ruta `/api/pdf?template=schedule&mode=view`).
 * Tabla con cabecera repetida en saltos de página, eje temporal y barras recortadas al rango.
 */
export function buildScheduleVisualPrintHtml(
  layout: PrintDocumentLayout,
  page: ScheduleVisualPrintData,
  options: ScheduleVisualPrintOptions = {}
): string {
  const locale = options.locale ?? 'es'
  const L = strings(locale)
  const fromMs = page.fromDate.getTime()
  const toMs = page.toDate.getTime()
  const totalMs = Math.max(toMs - fromMs, 1)

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

  const ticks = buildTimelineTicks(page.fromDate, page.toDate, locale)
  const tickMarksHtml = ticks
    .map(
      (tk) =>
        `<div style="position:absolute;left:${tk.pct}%;top:0;bottom:0;width:0;border-left:1px solid #cbd5e1;transform:translateX(-50%);"></div>`
    )
    .join('')
  const tickLabelsHtml = ticks
    .map(
      (tk) =>
        `<span style="position:absolute;left:${tk.pct}%;top:2px;transform:translateX(-50%);font-size:8px;line-height:1;color:#475569;white-space:nowrap;max-width:72px;overflow:hidden;text-overflow:ellipsis;">${esc(tk.label)}</span>`
    )
    .join('')

  const rowsHtml =
    page.tasks.length === 0
      ? `<tr><td colspan="2" style="padding:20px 12px;border:1px solid #e2e8f0;font-size:11px;text-align:center;color:#64748b;">${esc(L.emptyPeriod)}</td></tr>`
      : page.tasks
          .map((t) => {
            const label = `${t.code} ${t.name}`.trim()
            const bar = renderTaskBar(t, fromMs, toMs, totalMs)
            return `<tr>
  <td style="width:28%;max-width:0;padding:8px 10px;border:1px solid #e2e8f0;font-size:10px;line-height:1.35;vertical-align:middle;word-wrap:break-word;overflow-wrap:anywhere;hyphens:auto;">${esc(label)}</td>
  <td style="width:72%;max-width:0;padding:8px 10px;border:1px solid #e2e8f0;vertical-align:middle;">${bar}</td>
</tr>`
          })
          .join('')

  const periodLine = `${L.period}: ${esc(formatRangeLine(page.fromDate, page.toDate, locale))}`

  return `<!doctype html>
<html lang="${locale.toLowerCase().startsWith('en') ? 'en' : 'es'}">
<head>
  <meta charset="utf-8" />
  <title>${esc(L.title)}</title>
  <style>
    @page { margin: 12mm 10mm 14mm 10mm; }
    table.gantt-print { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead.gantt-print-head { display: table-header-group; }
    tbody.gantt-print-body tr { break-inside: avoid; page-break-inside: avoid; }
    h2.gantt-title { font-size: 15px; margin: 0 0 4px; font-weight: 600; }
    p.gantt-sub { font-size: 11px; margin: 0 0 12px; color: #475569; }
  </style>
</head>
<body style="margin:0;padding:10px 8px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  ${headerHtml}
  <h2 class="gantt-title">${esc(L.title)}</h2>
  <p class="gantt-sub">${periodLine}</p>
  <table class="gantt-print" role="table">
    <thead class="gantt-print-head">
      <tr>
        <th style="padding:0;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;vertical-align:bottom;">
          <div style="padding:8px 10px;font-size:11px;font-weight:600;">${esc(L.codeTask)}</div>
        </th>
        <th style="width:72%;padding:0;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;vertical-align:bottom;">
          <div style="position:relative;height:26px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">
            ${tickMarksHtml}
            ${tickLabelsHtml}
          </div>
          <div style="padding:6px 10px;font-size:11px;font-weight:600;">${esc(L.timeline)}</div>
        </th>
      </tr>
    </thead>
    <tbody class="gantt-print-body">${rowsHtml}</tbody>
  </table>
</body>
</html>`
}
