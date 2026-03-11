/**
 * Builds a CSV string with optional header block (org, project, report title, date, filters)
 * and data rows. Use for all list/report CSV exports so context is consistent.
 * Output is UTF-8 with BOM for Excel.
 */

export interface CsvHeaderContext {
  /** Organization/company name. */
  orgName: string
  /** Project name when export is project-scoped. */
  projectName?: string | null
  /** Project number when available. */
  projectNumber?: string | null
  /** Report or list title (e.g. "Cuentas por pagar", "Avance vs costo"). */
  reportTitle: string
  /** Generation date (formatted string or Date). */
  generatedAt: string | Date
  /** Optional summary of applied filters (e.g. "Período: 01/01/2025 - 31/01/2025"). */
  filterSummary?: string | null
}

export interface BuildCsvWithHeaderParams {
  /** When provided, prepend header block with org, project, title, date, filters. */
  header?: CsvHeaderContext | null
  /** Column headers (one per column). */
  columnHeaders: string[]
  /** Data rows; each row is an array of cell values (strings or numbers). */
  rows: (string | number)[][]
}

function formatGeneratedAt(at: string | Date): string {
  if (typeof at === 'string') return at
  return at.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Escape a cell for CSV (wrap in quotes if contains comma, quote, or newline). */
function escapeCsvCell(value: string | number): string {
  const s = String(value)
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Returns CSV string (with optional header block), UTF-8.
 * Caller should prepend BOM when saving as file: '\uFEFF' + result
 */
export function buildCsvWithHeader({
  header,
  columnHeaders,
  rows,
}: BuildCsvWithHeaderParams): string {
  const lines: string[] = []

  if (header) {
    lines.push(header.orgName.trim() || '—')
    if (header.projectName != null && header.projectName.trim() !== '') {
      const projectLine = header.projectNumber
        ? `${header.projectName.trim()} (${header.projectNumber})`
        : header.projectName.trim()
      lines.push(`Proyecto: ${projectLine}`)
    }
    lines.push(`Reporte: ${header.reportTitle.trim() || '—'}`)
    lines.push(`Generado: ${formatGeneratedAt(header.generatedAt)}`)
    if (header.filterSummary != null && header.filterSummary.trim() !== '') {
      lines.push(header.filterSummary.trim())
    }
    lines.push('')
  }

  const headerRow = columnHeaders.map(escapeCsvCell).join(',')
  lines.push(headerRow)
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','))
  }

  return lines.join('\n')
}
