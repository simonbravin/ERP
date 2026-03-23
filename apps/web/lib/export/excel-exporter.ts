import * as XLSX from 'xlsx'
import type { ExcelConfig, ExportColumn } from '@/lib/types/export'

export class ExcelExporter {
  private config: ExcelConfig
  private workbook: XLSX.WorkBook
  private worksheet: XLSX.WorkSheet

  constructor(config: ExcelConfig) {
    this.config = config
    this.workbook = XLSX.utils.book_new()
    this.worksheet = {}
  }

  async generate(): Promise<Buffer> {
    const rows = this.buildRows()
    this.worksheet = XLSX.utils.aoa_to_sheet(rows)
    this.applyStyles()
    this.setColumnWidths()
    XLSX.utils.book_append_sheet(
      this.workbook,
      this.worksheet,
      this.config.sheetName || 'Reporte'
    )
    return XLSX.write(this.workbook, { type: 'buffer', bookType: 'xlsx' })
  }

  private buildRows(): unknown[][] {
    const rows: unknown[][] = []

    if (this.config.includeCompanyHeader) {
      rows.push([this.config.metadata?.generatedBy || 'Empresa'])
      rows.push(['CUIT:', 'Dirección:', 'Teléfono:', 'Email:'])
      rows.push(['', '', '', ''])
      rows.push([])
    }

    rows.push([this.config.title])
    if (this.config.subtitle) {
      rows.push([this.config.subtitle])
    }
    rows.push([])

    if (this.config.project) {
      rows.push(['Proyecto:', this.config.project.name])
      rows.push(['Nro. Proyecto:', this.config.project.number])
      if (this.config.project.client) {
        rows.push(['Cliente:', this.config.project.client])
      }
    }
    if (this.config.metadata?.version) {
      rows.push(['Versión:', this.config.metadata.version])
    }
    if (this.config.metadata?.date) {
      rows.push(['Fecha:', this.config.metadata.date.toLocaleDateString('es-AR')])
    }
    if (this.config.metadata?.filters && this.config.metadata.filters.length > 0) {
      rows.push(['Filtros aplicados:'])
      this.config.metadata.filters.forEach((filter) => {
        rows.push(['', filter])
      })
    }
    rows.push([])

    const visibleColumns = this.config.columns.filter((col) => col.visible !== false)
    const headerRow = visibleColumns.map((col) => col.label)
    rows.push(headerRow)

    if (this.config.groupBy) {
      const grouped = this.groupData(this.config.data, this.config.groupBy.field)
      for (const [groupValue, groupData] of Object.entries(grouped)) {
        rows.push([`${this.config.groupBy.label}: ${groupValue}`])
        ;(groupData as Record<string, unknown>[]).forEach((item) => {
          const row = visibleColumns.map((col) => this.formatValue(item[col.field], col))
          rows.push(row)
        })
        if (this.config.groupBy.showTotals) {
          const totalsRow = this.calculateTotals(groupData as Record<string, unknown>[], visibleColumns)
          rows.push(totalsRow)
        }
        rows.push([])
      }
    } else {
      this.config.data.forEach((item) => {
        const record = item as Record<string, unknown>
        const row = visibleColumns.map((col) => this.formatValue(record[col.field], col))
        rows.push(row)
      })
    }

    if (this.config.totals) {
      rows.push([])
      const totalsRow = this.calculateTotals(this.config.data as Record<string, unknown>[], visibleColumns)
      totalsRow[0] = this.config.totals.label
      rows.push(totalsRow)
    }

    return rows
  }

  private formatValue(value: unknown, column: ExportColumn): unknown {
    if (value === null || value === undefined) return ''
    switch (column.type) {
      case 'currency':
        return typeof value === 'number' ? value : parseFloat(String(value)) || 0
      case 'number':
        return typeof value === 'number' ? value : parseFloat(String(value)) || 0
      case 'percentage':
        return typeof value === 'number' ? value / 100 : parseFloat(String(value)) / 100 || 0
      case 'date':
        if (value instanceof Date) return value.toLocaleDateString('es-AR')
        return new Date(value as string).toLocaleDateString('es-AR')
      case 'text':
      default:
        return String(value)
    }
  }

  private groupData(data: unknown[], field: string): Record<string, unknown[]> {
    const rows = data as Record<string, unknown>[]
    return rows.reduce<Record<string, unknown[]>>(
      (acc, item) => {
        const key = String(item[field] ?? 'Sin agrupar')
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      },
      {}
    )
  }

  private calculateTotals(
    data: Record<string, unknown>[],
    columns: ExportColumn[]
  ): unknown[] {
    return columns.map((col, idx) => {
      if (idx === 0) return 'TOTAL'
      if (col.type === 'currency' || col.type === 'number') {
        const sum = data.reduce((acc, item) => {
          const raw = item[col.field]
          const value = typeof raw === 'number' ? raw : parseFloat(String(raw)) || 0
          return acc + value
        }, 0)
        return sum
      }
      return ''
    })
  }

  private applyStyles(): void {
    // Column widths are set in setColumnWidths. Cell number formats (.z) are
    // not applied here to avoid overwriting header/title cells; data is already numeric.
  }

  private setColumnWidths(): void {
    const visibleColumns = this.config.columns.filter((col) => col.visible !== false)
    this.worksheet['!cols'] = visibleColumns.map((col) => ({
      wch: col.width ?? 15,
    }))
  }
}

/**
 * Helper to export to Excel
 */
export async function exportToExcel(config: ExcelConfig): Promise<Buffer> {
  const exporter = new ExcelExporter(config)
  return await exporter.generate()
}
