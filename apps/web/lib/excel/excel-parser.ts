import * as XLSX from 'xlsx'
import type { ExcelRow, ParsedWbsItem, ImportWarning } from '@/lib/types/excel-import'

/**
 * Parser principal de Excel - formato presupuesto oficial argentino
 */
export class ExcelParser {
  private warnings: ImportWarning[] = []

  /**
   * Lee archivo Excel y extrae filas con datos
   */
  parseFile(file: File): Promise<ExcelRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })

          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<any>(firstSheet, { header: 1 })

          const parsedRows = this.extractRows(rows)
          resolve(parsedRows)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsBinaryString(file)
    })
  }

  /**
   * Extrae filas relevantes del Excel.
   * Formato estándar: Código, Descripción, Unidad, Cantidad, Importe
   */
  private extractRows(rows: any[][]): ExcelRow[] {
    const extracted: ExcelRow[] = []

    let headerRow = -1
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i]
      if (!row || !Array.isArray(row)) continue
      const rowStr = row.map((c: unknown) => String(c ?? '')).join(' ').toUpperCase()
      if (
        rowStr.includes('ITEM') ||
        rowStr.includes('DESIGNACIÓN') ||
        rowStr.includes('DESIGNACION') ||
        rowStr.includes('CÓDIGO') ||
        rowStr.includes('CODIGO')
      ) {
        headerRow = i
        break
      }
    }

    if (headerRow === -1) {
      throw new Error(
        'No se encontró el encabezado del presupuesto. Verifica que el archivo tenga el formato correcto.'
      )
    }

    const headers = rows[headerRow] as unknown[]
    const codeColIdx = this.findColumnIndex(headers, ['ITEM', 'CÓDIGO', 'CODIGO'])
    const descColIdx = this.findColumnIndex(headers, [
      'DESIGNACIÓN',
      'DESIGNACION',
      'DESCRIPCIÓN',
      'DESCRIPCION',
    ])
    const unitColIdx = this.findColumnIndex(headers, ['UNIDAD', 'UM', 'U.M.'])
    const qtyColIdx = this.findColumnIndex(headers, ['CANTIDAD', 'CANT', 'QTY'])
    const amountColIdx = this.findColumnIndex(headers, ['IMPORTE', 'PARCIAL', 'TOTAL'])

    if (codeColIdx === -1 || descColIdx === -1) {
      throw new Error('No se pudieron detectar las columnas de código y descripción')
    }

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue

      const code = this.cleanCode(row[codeColIdx])
      if (!code) continue

      const description = this.cleanString(row[descColIdx])
      if (!description) continue

      const unit = unitColIdx !== -1 ? this.cleanString(row[unitColIdx]) : null
      const quantity = qtyColIdx !== -1 ? this.parseNumber(row[qtyColIdx]) : null
      const amount = amountColIdx !== -1 ? this.parseNumber(row[amountColIdx]) : null

      if (unit && quantity == null) {
        this.warnings.push({
          type: 'missing_quantity',
          rowNumber: i + 1,
          code,
          message: `Item "${description}" tiene unidad pero no cantidad. Se asumirá cantidad = 1.`,
        })
      }

      extracted.push({
        rowNumber: i + 1,
        code,
        description,
        unit,
        quantity,
        amount,
      })
    }

    return extracted
  }

  /**
   * Construye árbol jerárquico desde filas planas
   */
  buildTree(rows: ExcelRow[]): ParsedWbsItem[] {
    const items = new Map<string, ParsedWbsItem>()
    const rootItems: ParsedWbsItem[] = []

    for (const row of rows) {
      if (!row.code) continue

      const level = this.getLevel(row.code)
      const isLeaf = Boolean(row.unit)

      let quantity = row.quantity ?? 1
      let unitPrice = 0

      if (row.amount != null) {
        if (quantity > 0) {
          unitPrice = row.amount / quantity
        } else {
          quantity = 1
          unitPrice = row.amount
        }
      }

      const item: ParsedWbsItem = {
        code: row.code,
        name: row.description || '',
        level,
        unit: row.unit,
        quantity,
        amount: row.amount ?? 0,
        unitPrice,
        parentCode: this.getParentCode(row.code),
        children: [],
        isLeaf,
      }

      items.set(row.code, item)
    }

    for (const item of items.values()) {
      if (item.parentCode && items.has(item.parentCode)) {
        const parent = items.get(item.parentCode)!
        parent.children.push(item)
      } else {
        rootItems.push(item)
      }
    }

    function sortChildren(item: ParsedWbsItem) {
      item.children.sort((a, b) => a.code.localeCompare(b.code))
      item.children.forEach(sortChildren)
    }

    rootItems.sort((a, b) => a.code.localeCompare(b.code))
    rootItems.forEach(sortChildren)

    return rootItems
  }

  private getLevel(code: string): number {
    const match = code.match(/\d+(\.\d+)*/)?.[0]
    if (!match) return 0
    return match.split('.').length - 1
  }

  private getParentCode(code: string): string | null {
    const parts = code.split('.')
    if (parts.length <= 1) return null
    return parts.slice(0, -1).join('.')
  }

  private findColumnIndex(headers: unknown[], possibleNames: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] ?? '').toUpperCase().trim()
      for (const name of possibleNames) {
        if (header.includes(name)) return i
      }
    }
    return -1
  }

  private cleanCode(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const str = String(value).trim()
    if (!str) return null
    const normalized = str.toUpperCase()
    if (!/^[A-Z]+\s+\d+/.test(normalized)) return null
    return normalized
  }

  private cleanString(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const str = String(value).trim()
    return str || null
  }

  private parseNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }

  getWarnings(): ImportWarning[] {
    return [...this.warnings]
  }

  resetWarnings() {
    this.warnings = []
  }
}
