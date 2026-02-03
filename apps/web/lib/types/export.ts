/**
 * Types for generic export and reporting (Excel + PDF).
 * Reusable across budget, materials, finance, certifications.
 */

export interface ExportConfig {
  title: string
  subtitle?: string
  includeCompanyHeader: boolean
  project?: {
    name: string
    number: string
    client?: string
    location?: string
  }
  metadata?: {
    version?: string
    date?: Date
    generatedBy?: string
    filters?: string[]
  }
  columns: ExportColumn[]
  data: unknown[]
  groupBy?: {
    field: string
    label: string
    showTotals?: boolean
  }
  totals?: {
    label: string
    fields: string[]
  }
  template?: 'default' | 'materials' | 'budget' | 'finance' | 'certifications'
}

export interface ExportColumn {
  field: string
  label: string
  type: 'text' | 'number' | 'currency' | 'date' | 'percentage'
  width?: number
  align?: 'left' | 'center' | 'right'
  format?: string
  visible?: boolean
}

export interface PDFConfig extends ExportConfig {
  orientation: 'portrait' | 'landscape'
  pageSize: 'A4' | 'Letter' | 'Legal'
  showPageNumbers: boolean
}

export interface ExcelConfig extends ExportConfig {
  sheetName: string
  freezeHeader: boolean
  autoFilter: boolean
}

export interface ReportQuery {
  table: string
  joins?: Array<{
    table: string
    on: string
  }>
  where?: Record<string, unknown>
  select: string[]
  groupBy?: string[]
  orderBy?: Array<{
    field: string
    direction: 'asc' | 'desc'
  }>
}
