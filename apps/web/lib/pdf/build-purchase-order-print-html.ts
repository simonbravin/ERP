/**
 * Builds full HTML for the purchase order print view. Used by the PDF API.
 * Same structure as budget: company header, document title, project/supplier info, table of lines, total.
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

export type PurchaseOrderPrintLayoutData = {
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

export type PurchaseOrderPrintRow = {
  description: string
  wbsCode?: string
  unit: string
  quantity: number
  unitPrice: number
  totalCost: number
}

export type PurchaseOrderPrintPageData = {
  commitmentNumber: string
  projectName: string
  projectNumber?: string | null
  supplierName: string
  issueDate: Date | string
  rows: PurchaseOrderPrintRow[]
  grandTotal: number
}

export type PurchaseOrderPrintOptions = {
  showEmitidoPor?: boolean
  showFullCompanyData?: boolean
  includeWbsColumn?: boolean
}

export function buildPurchaseOrderPrintHtml(
  layout: PurchaseOrderPrintLayoutData,
  page: PurchaseOrderPrintPageData,
  options: PurchaseOrderPrintOptions = {}
): string {
  const { showEmitidoPor = true, showFullCompanyData = true, includeWbsColumn = false } = options
  const displayName = (layout.orgLegalName || layout.orgName).trim() || '—'
  const dateStr =
    page.issueDate instanceof Date
      ? page.issueDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date(page.issueDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const legalId = getLegalIdDisplay({
    taxId: layout.taxId ?? null,
    country: layout.country ?? null,
  })
  const legalLine = legalId ? `${legalId.label}: ${legalId.value}` : null
  const hasLegal =
    showFullCompanyData &&
    [legalLine, layout.address, layout.email, layout.phone].some(
      (v) => v != null && String(v).trim() !== ''
    )
  const projectLine =
    layout.orgName && page.projectName
      ? page.projectName + (page.projectNumber ? ` (${page.projectNumber})` : '')
      : null
  const folioLine = `OC: ${esc(page.commitmentNumber)}`
  const issuedLine =
    showEmitidoPor &&
    layout.userNameOrEmail != null &&
    layout.userNameOrEmail.trim() !== ''
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

  const rowPadding = '0.15rem 0.4rem'
  const headerFooterPadding = '0.375rem 0.5rem'
  const tableFontSize = '0.6875rem'
  const numCell = 'text-align:right;white-space:nowrap;'

  const wbsCol = includeWbsColumn
  const thWbs = wbsCol ? `<th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:left;background:#f3f4f6;font-weight:600;">Código WBS</th>` : ''
  const tdWbs = (r: PurchaseOrderPrintRow) =>
    wbsCol ? `<td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};">${esc(r.wbsCode ?? '')}</td>` : ''
  const totalColspan = 4
  const totalRowWbsCell = wbsCol ? `<td style="padding:${headerFooterPadding};border:1px solid #e2e8f0;font-weight:700;background:#f3f4f6;"></td>` : ''

  const rowsHtml = page.rows.map(
    (r) => `<tr>
      ${tdWbs(r)}
      <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};">${esc(r.description)}</td>
      <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};text-align:center;">${esc(r.unit)}</td>
      <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};${numCell}">${r.quantity}</td>
      <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};${numCell}">${esc(formatCurrency(r.unitPrice))}</td>
      <td style="padding:${rowPadding};border:1px solid #e2e8f0;font-size:${tableFontSize};${numCell}">${esc(formatCurrency(r.totalCost))}</td>
    </tr>`
  )

  const documentTitle = 'Orden de compra'
  const supplierBlock = `<p style="font-size:0.8125rem;color:#475569;margin:0 0 0.5rem;"><strong>Proveedor:</strong> ${esc(page.supplierName)}</p>`

  const tableHtml = `
<div class="document-title" style="margin-top:24px;margin-bottom:0.25rem;">
  <h2 style="font-size:1.125rem;font-weight:600;margin:0;background:transparent;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${esc(documentTitle)}</h2>
</div>
${supplierBlock}
<table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
  <thead>
    <tr>
      ${thWbs}
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:left;background:#f3f4f6;font-weight:600;">Descripción</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:center;background:#f3f4f6;font-weight:600;">U</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:right;background:#f3f4f6;font-weight:600;">Cantidad</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:right;background:#f3f4f6;font-weight:600;">P.Unit</th>
      <th style="padding:${headerFooterPadding};border:1px solid #e2e8f0;text-align:right;background:#f3f4f6;font-weight:600;">Total</th>
    </tr>
  </thead>
  <tbody>${rowsHtml.join('')}
    <tr>
      ${totalRowWbsCell}
      <td colspan="${totalColspan}" style="padding:${headerFooterPadding};border:1px solid #e2e8f0;font-weight:700;background:#f3f4f6;">Total</td>
      <td style="padding:${headerFooterPadding};border:1px solid #e2e8f0;font-weight:700;background:#f3f4f6;text-align:right;white-space:nowrap;">${esc(formatCurrency(page.grandTotal))}</td>
    </tr>
  </tbody>
</table>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Orden de compra</title>
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
