/**
 * Encabezado corporativo reutilizable para PDFs generados desde HTML
 * (presupuesto, cronograma, etc.). El pie con numeración vive en `render-pdf.ts`.
 */

import { getLegalIdDisplay } from '@/lib/print/legal-id'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type PrintDocumentLayout = {
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

export type BuildPrintDocumentHeaderOptions = {
  showFullCompanyData: boolean
  showEmitidoPor: boolean
  /** Línea bajo el bloque legal, p. ej. nombre de proyecto + número */
  projectLine: string | null
  /** Texto adicional en la misma línea (p. ej. rango de fechas del PDF) */
  projectLineSuffix?: string | null
  /**
   * Líneas en la columna derecha, después de "Fecha:".
   * Cada elemento es texto plano (se escapa al renderizar).
   */
  folioLines: string[]
  /** BCP 47 / prefijo, p. ej. es, en */
  locale: string
}

function dateLocaleTag(locale: string): string {
  return locale.toLowerCase().startsWith('en') ? 'en-GB' : 'es-AR'
}

/**
 * Cabecera alineada visualmente con el PDF de presupuesto: fondo #e2e8f0, logo, datos fiscales opcionales.
 */
export function buildPrintDocumentHeaderHtml(
  layout: PrintDocumentLayout,
  options: BuildPrintDocumentHeaderOptions
): string {
  const {
    showFullCompanyData,
    showEmitidoPor,
    projectLine,
    projectLineSuffix,
    folioLines,
    locale,
  } = options

  const displayName = (layout.orgLegalName || layout.orgName).trim() || '—'
  const dateStr = new Date().toLocaleDateString(dateLocaleTag(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

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

  const issuedPlain =
    showEmitidoPor && layout.userNameOrEmail != null && layout.userNameOrEmail.trim() !== ''
      ? layout.userNameOrEmail.trim()
      : null

  const rightSpans: string[] = [`Fecha: ${dateStr}`, ...folioLines]
  if (issuedPlain) {
    rightSpans.push(`Emitido por: ${issuedPlain}`)
  }

  const projectFull =
    projectLine != null && projectLine !== ''
      ? projectLine + (projectLineSuffix ?? '')
      : null

  return `
<header style="padding:0.75rem 1rem;margin-bottom:1rem;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;background:#e2e8f0;">
  <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;max-width:65%;">
    ${showFullCompanyData && layout.logoUrl ? `<img src="${esc(layout.logoUrl)}" alt="" style="height:2.5rem;width:auto;object-fit:contain;" />` : ''}
    <div>
      <h1 style="font-size:1rem;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.02em;color:#0f172a;">${esc(displayName)}</h1>
      ${hasLegal ? `<div style="font-size:0.6875rem;line-height:1.3;color:#64748b;margin-top:0.2rem;">${[legalLine, layout.address, layout.email, layout.phone].filter(Boolean).map((t) => `<span style="display:block;">${esc(String(t!))}</span>`).join('')}</div>` : ''}
      ${projectFull ? `<p style="font-size:0.8125rem;color:#64748b;margin:0.25rem 0 0;">${esc(projectFull)}</p>` : ''}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:flex-end;font-size:0.75rem;color:#64748b;max-width:35%;">
    ${rightSpans.map((line) => `<span>${esc(line)}</span>`).join('')}
  </div>
</header>`
}
