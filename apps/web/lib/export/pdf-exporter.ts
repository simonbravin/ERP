import PDFDocument from 'pdfkit'
import type { PDFConfig, ExportColumn } from '@/lib/types/export'
import { formatCurrency, formatNumber } from '@/lib/format-utils'

export class PDFExporter {
  private config: PDFConfig
  private doc: PDFKit.PDFDocument
  private currentY = 0
  private pageWidth = 0
  private pageHeight = 0
  private readonly marginLeft = 50
  private readonly marginRight = 50
  private readonly marginTop = 50
  private readonly marginBottom = 50

  constructor(config: PDFConfig) {
    this.config = config
    this.doc = new PDFDocument({
      size: config.pageSize ?? 'A4',
      layout: config.orientation ?? 'portrait',
      margins: {
        top: this.marginTop,
        bottom: this.marginBottom,
        left: this.marginLeft,
        right: this.marginRight,
      },
      bufferPages: true,
    })
    this.pageWidth = this.doc.page.width
    this.pageHeight = this.doc.page.height
    this.currentY = this.marginTop
  }

  async generate(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      this.doc.on('end', () => resolve(Buffer.concat(chunks)))
      this.doc.on('error', reject)
      try {
        if (this.config.includeCompanyHeader) {
          this.drawCompanyHeader()
        }
        this.drawTitle()
        this.drawMetadata()
        this.drawTable()
        if (this.config.showPageNumbers) {
          this.drawPageNumbers()
        }
        this.doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }

  private drawCompanyHeader(): void {
    this.doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('NOMBRE EMPRESA', this.marginLeft, this.currentY, { align: 'left' })
    this.currentY += 20
    this.doc.fontSize(8).font('Helvetica')
    const leftCol = this.marginLeft
    const rightCol = this.pageWidth / 2
    this.doc.text('CUIT: 00-00000000-0', leftCol, this.currentY)
    this.doc.text('Tel: +54 11 0000-0000', rightCol, this.currentY)
    this.currentY += 12
    this.doc.text('Dirección: Calle 123, CABA', leftCol, this.currentY)
    this.doc.text('Email: info@empresa.com', rightCol, this.currentY)
    this.currentY += 20
    this.doc
      .strokeColor('#cbd5e1')
      .lineWidth(1)
      .moveTo(this.marginLeft, this.currentY)
      .lineTo(this.pageWidth - this.marginRight, this.currentY)
      .stroke()
    this.currentY += 20
  }

  private drawTitle(): void {
    this.doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text(this.config.title, this.marginLeft, this.currentY, {
        align: 'center',
        width: this.pageWidth - this.marginLeft - this.marginRight,
      })
    this.currentY += 25
    if (this.config.subtitle) {
      this.doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(this.config.subtitle, this.marginLeft, this.currentY, {
          align: 'center',
          width: this.pageWidth - this.marginLeft - this.marginRight,
        })
      this.currentY += 20
    }
    this.currentY += 10
  }

  private drawMetadata(): void {
    this.doc.fontSize(9).font('Helvetica').fillColor('#475569')
    if (this.config.project) {
      this.doc.text(
        `Proyecto: ${this.config.project.name} (${this.config.project.number})`,
        this.marginLeft,
        this.currentY
      )
      this.currentY += 12
      if (this.config.project.client) {
        this.doc.text(`Cliente: ${this.config.project.client}`, this.marginLeft, this.currentY)
        this.currentY += 12
      }
    }
    if (this.config.metadata?.date) {
      this.doc.text(
        `Fecha: ${this.config.metadata.date.toLocaleDateString('es-AR')}`,
        this.marginLeft,
        this.currentY
      )
      this.currentY += 12
    }
    if (this.config.metadata?.filters && this.config.metadata.filters.length > 0) {
      this.doc.text('Filtros aplicados:', this.marginLeft, this.currentY)
      this.currentY += 12
      this.config.metadata.filters.forEach((filter) => {
        this.doc.text(`  • ${filter}`, this.marginLeft + 10, this.currentY)
        this.currentY += 12
      })
    }
    this.currentY += 10
  }

  private drawTable(): void {
    const visibleColumns = this.config.columns.filter((col) => col.visible !== false)
    const availableWidth = this.pageWidth - this.marginLeft - this.marginRight
    const columnWidth = availableWidth / visibleColumns.length

    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .rect(this.marginLeft, this.currentY, availableWidth, 20)
      .fill('#1e293b')
    visibleColumns.forEach((col, idx) => {
      const x = this.marginLeft + idx * columnWidth
      this.doc.text(col.label, x + 5, this.currentY + 6, {
        width: columnWidth - 10,
        align: (col.align as 'left' | 'center' | 'right') ?? 'left',
      })
    })
    this.currentY += 25
    this.doc.fontSize(8).font('Helvetica').fillColor('#0f172a')

    const data = this.config.data as Record<string, unknown>[]
    data.forEach((item, rowIdx) => {
      if (this.currentY > this.pageHeight - this.marginBottom - 30) {
        this.doc.addPage()
        this.currentY = this.marginTop
        this.doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#ffffff')
          .rect(this.marginLeft, this.currentY, availableWidth, 20)
          .fill('#1e293b')
        visibleColumns.forEach((col, idx) => {
          const x = this.marginLeft + idx * columnWidth
          this.doc.text(col.label, x + 5, this.currentY + 6, {
            width: columnWidth - 10,
            align: (col.align as 'left' | 'center' | 'right') ?? 'left',
          })
        })
        this.currentY += 25
        this.doc.fontSize(8).font('Helvetica').fillColor('#0f172a')
      }
      if (rowIdx % 2 === 0) {
        this.doc.rect(this.marginLeft, this.currentY, availableWidth, 18).fill('#f8fafc')
      }
      visibleColumns.forEach((col, idx) => {
        const x = this.marginLeft + idx * columnWidth
        const value = this.formatValue(item[col.field], col)
        this.doc.text(value, x + 5, this.currentY + 4, {
          width: columnWidth - 10,
          align: (col.align as 'left' | 'center' | 'right') ?? 'left',
        })
      })
      this.currentY += 18
    })

    if (this.config.totals) {
      this.currentY += 10
      this.doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .rect(this.marginLeft, this.currentY, availableWidth, 20)
        .fill('#dbeafe')
      const totalsRow = this.calculateTotals(data, visibleColumns)
      totalsRow[0] = this.config.totals.label
      visibleColumns.forEach((col, idx) => {
        const x = this.marginLeft + idx * columnWidth
        this.doc
          .fillColor('#1e3a8a')
          .text(String(totalsRow[idx] ?? ''), x + 5, this.currentY + 6, {
            width: columnWidth - 10,
            align: (col.align as 'left' | 'center' | 'right') ?? 'left',
          })
      })
    }
  }

  private drawPageNumbers(): void {
    const range = this.doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      this.doc.switchToPage(i)
      const pageNumber = `Página ${i + 1} de ${range.count}`
      this.doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(pageNumber, this.marginLeft, this.pageHeight - this.marginBottom + 10, {
          align: 'center',
          width: this.pageWidth - this.marginLeft - this.marginRight,
        })
    }
  }

  private formatValue(value: unknown, column: ExportColumn): string {
    if (value === null || value === undefined) return ''
    switch (column.type) {
      case 'currency':
        return formatCurrency(parseFloat(String(value)) || 0)
      case 'number':
        return formatNumber(parseFloat(String(value)) || 0)
      case 'percentage':
        return `${(parseFloat(String(value)) || 0).toFixed(2)}%`
      case 'date':
        if (value instanceof Date) return value.toLocaleDateString('es-AR')
        return new Date(value as string).toLocaleDateString('es-AR')
      case 'text':
      default:
        return String(value)
    }
  }

  private calculateTotals(
    data: Record<string, unknown>[],
    columns: ExportColumn[]
  ): string[] {
    return columns.map((col, idx) => {
      if (idx === 0) return ''
      if (col.type === 'currency' || col.type === 'number') {
        const sum = data.reduce((acc, item) => {
          const value = parseFloat(String(item[col.field])) || 0
          return acc + value
        }, 0)
        return col.type === 'currency' ? formatCurrency(sum) : formatNumber(sum)
      }
      return ''
    })
  }
}

/**
 * Helper to export to PDF
 */
export async function exportToPDF(config: PDFConfig): Promise<Buffer> {
  const exporter = new PDFExporter(config)
  return await exporter.generate()
}
