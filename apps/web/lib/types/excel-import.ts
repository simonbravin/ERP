export interface ExcelRow {
  rowNumber: number
  code: string | null // ARQ 1, ARQ 1.1, etc.
  description: string | null
  unit: string | null
  quantity: number | null
  amount: number | null // Importe total
}

export interface ParsedWbsItem {
  code: string
  name: string
  level: number // Cantidad de puntos en el código
  unit: string | null
  quantity: number
  amount: number
  unitPrice: number // Calculado: amount / quantity
  parentCode: string | null
  children: ParsedWbsItem[]
  isLeaf: boolean // true si tiene unidad (item final)
}

export interface ImportPreview {
  projectName: string
  totalItems: number
  totalAmount: number
  rootItems: ParsedWbsItem[]
  warnings: ImportWarning[]
}

export interface ImportWarning {
  type: 'missing_quantity' | 'missing_unit' | 'invalid_hierarchy' | 'duplicate_code'
  rowNumber: number
  code: string
  message: string
}

export interface ImportResult {
  success: boolean
  projectId?: string
  budgetVersionId?: string
  itemsCreated: number
  warnings: ImportWarning[]
  error?: string
}
