/**
 * Builds full HTML for the budget print view. Used by the PDF API to avoid
 * fetching the print route (which can 500 when session context is lost in internal fetch).
 */

import { getLegalIdDisplay } from '@/lib/print/legal-id'
import { formatCurrency } from '@/lib/format-utils'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Derive hierarchy level from WBS code (e.g. "1" -> 0, "1.1" -> 1, "1.1.1" -> 2). */
function levelFromCode(code: string): number {
  if (!code || typeof code !== 'string') return 0
  const dots = code.match(/\./g)
  return dots ? dots.length : 0
}

export type BudgetPrintLayoutData = {
  orgName: string
  orgLegalName?: string | null
  logoUrl?: string | null
  taxId?: string | null
  country?: string | null
  address?: string | null
  email?: string | null
  phone?: string | null
  userNameOrEmail?: string | null
}

export type BudgetPrintProjectInfo = {
  projectName: string
  projectNumber?: string | null
  clientName?: string | null
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  surfaceM2?: number | string | null
  description?: string | null
}

export type BudgetPrintRow = {
  code: string
  description: string
  unit: string
  quantity: number
  unitPrice: number
  totalCost: number
  incidenciaPct?: number
}

export type BudgetPrintPageData = {
  projectName: string
  projectNumber?: string | null
  versionCode: string
  projectInfo?: BudgetPrintProjectInfo | null
  /** All rows; sort by WBS code (numeric) and render with level indent. Do not filter. */
  rows: BudgetPrintRow[]
  grandTotal: number
}

export type BudgetPrintOptions = {
  showEmitidoPor?: boolean
  showFullCompanyData?: boolean
  includeIncidenciaColumn?: boolean
}

export function buildBudgetPrintHtml(
  layout: BudgetPrintLayoutData,
  page: BudgetPrintPageData,
  options: BudgetPrintOptions = {}
): string {
  const { showEmitidoPor = true, showFullCompanyData = true, includeIncidenciaColumn = false } = options
  const displayName = (layout.orgLegalName || layout.orgName).trim() || '—'
  const dateStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const legalId = getLegalIdDisplay({
    taxId: layout.taxId ?? null,
    country: layout.country ?? null,
  })
  const legalLine = legalId ? `${legalId.label}: ${legalId.value}` : null
  const hasLegal = showFullCompanyData && [legalLine, layout.address, layout.email, layout.phone].some(
    (v) => v != null && String(v).trim() !== ''
  )
  const projectLine =
    layout.orgName && page.projectName
      ? page.projectName + (page.projectNumber ? ` (${page.projectNumber})` : '')
      : null
  const folioLine = `Versión: ${esc(page.versionCode)}`
  const issuedLine = showEmitidoPor && layout.userNameOrEmail != null && layout.userNameOrEmail.trim() !== ''
    ? `Emitido por: ${esc(layout.userNameOrEmail.trim())}`
    : null

  const headerHtml = `
<header style="padding:0.75rem 1rem;margin-bottom:1rem;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;background:#e2e8f0;">
  <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;max-width:65%;">
    ${showFullCompanyData && layout.logoUrl ? `<img src="${esc(layout.logoUrl)}" alt="" style="height:2.5rem;width:auto;object-fit:contain;" />` : ''}
    <div>
      <h1 style="font-size:1rem;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.02em;color:#0f172a;">${esc(displayName)}</h1>
      ${hasLegal ? `<div style="font-size:0.6875rem;line-height:1.3;color:#64748b;margin-top:0.2rem;">${[legalLine, layout.address, layout.email, layout.phone].filter(Boolean).map((t) => `<span style="display:block;">${esc(String(t!))}</span>`).join('')}</div>` : ''}
      ${projectLine ? `<p style="font-size:0.8125rem;color:#64748b;margin:0.25rem 0 0;">${esc(projectLine)}</p>` : ''}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:flex-end;font-size:0.75rem;color:#64748b;max-width:35%;">
    <span>Fecha: ${esc(dateStr)}</span>
    <span>${esc(folioLine)}</span>
    ${issuedLine ? `<span>${esc(issuedLine)}</span>` : ''}
  </div>
</header>`

  const info = page.projectInfo
  const projectInfoRows: string[] = []
  if (info?.projectName) projectInfoRows.push(`<div><strong>Proyecto:</strong> ${esc(info.projectName)}</div>`)
  if (info?.clientName != null && String(info.clientName).trim() !== '') projectInfoRows.push(`<div><strong>Cliente:</strong> ${esc(String(info.clientName))}</div>`)
  if (info?.location != null && String(info.location).trim() !== '') projectInfoRows.push(`<div><strong>Ubicación:</strong> ${esc(String(info.location))}</div>`)
  if (info?.startDate != null && String(info.startDate).trim() !== '') projectInfoRows.push(`<div><strong>Inicio:</strong> ${esc(String(info.startDate))}</div>`)
  if (info?.endDate != null && String(info.endDate).trim() !== '') projectInfoRows.push(`<div><strong>Fecha de fin propuesta:</strong> ${esc(String(info.endDate))}</div>`)
  if (info?.surfaceM2 != null && String(info.surfaceM2).trim() !== '') projectInfoRows.push(`<div><strong>Superficie:</strong> ${esc(String(info.surfaceM2))} m²</div>`)
  const projectInfoHtml =
    projectInfoRows.length > 0
      ? `<section style="margin-bottom:1rem;font-size:0.75rem;color:#475569;display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;">${projectInfoRows.join('')}</section>`
      : ''
  const descriptionSubtitle =
    info?.description != null && String(info.description).trim() !== ''
      ? `<p style="font-size:0.8125rem;color:#475569;margin:0 0 1rem;line-height:1.35;">${esc(String(info.description))}</p>`
      : ''

  const sorted = [...page.rows].sort((a, b) =>
    (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true })
  )

  const rowPadding = '0.15rem 0.4rem'
  const headerFooterPadding = '0.375rem 0.5rem'
  const tableFontSize = '0.6875rem'
  const incCol = includeIncidenciaColumn
  const formatPct = (v: number | undefined | null) =>
    v != null && !Number.isNaN(Number(v))
      ? `${Number(v).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`
      : '—'
  const numCell = 'text-align:right;white-space:nowrap;'
  const incCell = (r: BudgetPrintRow) =>
    incCol ? `<td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};${numCell}">${esc(formatPct(r.incidenciaPct))}</td>` : ''
  const rowsHtml = sorted.map((r) => {
    const level = levelFromCode(r.code)
    const paddingLeft = level * 12
    return `<tr>
          <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};padding-left:${paddingLeft + 8}px;">${esc(r.code)}</td>
          <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};padding-left:${paddingLeft + 8}px;">${esc(r.description)}</td>
          <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};text-align:center;">${esc(r.unit)}</td>
          <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};${numCell}">${r.quantity}</td>
          <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};${numCell}">${esc(formatCurrency(r.unitPrice))}</td>
          <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};${numCell}">${esc(formatCurrency(r.totalCost))}</td>
          ${incCell(r)}
        </tr>`
  })

  const documentTitle = 'Presupuesto'
  const totalColspan = 5
  const thInc = incCol ? `<th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:right;background:#f3f4f6;font-weight:600;">Inc %</th>` : ''
  const totalRowIncCell = incCol ? `<td style="padding:${headerFooterPadding};border:1px solid #e2e8f0;font-weight:700;background:#f3f4f6;text-align:right;">—</td>` : ''

  const tableHtml = `
<div class="document-title" style="margin-top:24px;margin-bottom:0.25rem;">
  <h2 style="font-size:1.125rem;font-weight:600;margin:0;background:transparent;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${esc(documentTitle)}</h2>
</div>
${descriptionSubtitle}
${projectInfoHtml}
<table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
  <thead>
    <tr>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:left;background:#f3f4f6;font-weight:600;">Código</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:left;background:#f3f4f6;font-weight:600;">Descripción</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:center;background:#f3f4f6;font-weight:600;">U</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:right;background:#f3f4f6;font-weight:600;">Cantidad</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:right;background:#f3f4f6;font-weight:600;">P.Unit</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:right;background:#f3f4f6;font-weight:600;">Total</th>
      ${thInc}
    </tr>
  </thead>
  <tbody>${rowsHtml.join('')}
    <tr>
      <td colspan="${totalColspan}" style="padding:${headerFooterPadding};border:1px solid #e2e8f0;font-weight:700;background:#f3f4f6;">Total presupuesto</td>
      <td style="padding:${headerFooterPadding};border:1px solid #e2e8f0;font-weight:700;background:#f3f4f6;text-align:right;white-space:nowrap;">${esc(formatCurrency(page.grandTotal))}</td>
      ${totalRowIncCell}
    </tr>
  </tbody>
</table>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Presupuesto</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 0 1rem 2rem; }
    @page { size: A4; margin: 20mm; }
  </style>
</head>
<body>
  ${headerHtml}
  ${tableHtml}
</body>
</html>`
}
