export interface ConsolidatedMaterial {
  name: string
  description: string | null
  unit: string
  totalQuantity: number
  averageUnitCost: number
  totalCost: number
  suppliers: Array<{
    name: string
    quantity: number
    unitCost: number
  }>
  usedInItems: Array<{
    wbsCode: string
    wbsName: string
    quantity: number
  }>
}

export interface MaterialsBySupplier {
  supplierName: string
  totalCost: number
  materials: Array<{
    name: string
    unit: string
    quantity: number
    unitCost: number
    totalCost: number
  }>
}

export interface MaterialsListFilter {
  search: string
  supplierFilter: string | null
  minCost: number | null
  maxCost: number | null
  sortBy: 'name' | 'quantity' | 'cost'
  sortOrder: 'asc' | 'desc'
}

/** Line item for purchase order from budget materials (has WBS for traceability). */
export interface MaterialLineForPO {
  budgetResourceId: string
  wbsNodeId: string
  wbsCode: string
  wbsName: string
  description: string
  unit: string
  quantity: number
  unitCost: number
  totalCost: number
  supplierName: string | null
}
