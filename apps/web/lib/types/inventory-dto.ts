/**
 * DTOs for inventory data passed from Server Components / actions to Client Components.
 * Dates are ISO strings; decimals are numbers (use `serializeForClient` before crossing the boundary).
 */

export type InventoryCategoryNestedDto = {
  id: string
  name: string
  sortOrder?: number
  createdAt?: string
  categoryId?: string
}

/** Editable item payload on `/inventory/items/[id]/edit` (serialized Prisma row + includes). */
export type InventoryItemFormDto = {
  id: string
  orgId?: string
  sku: string
  name: string
  description: string | null
  categoryId: string
  subcategoryId: string | null
  unit: string
  minStockQty: number | null
  reorderQty: number | null
  active?: boolean
  createdAt?: string
  updatedAt?: string
  metadata?: unknown
  category?: InventoryCategoryNestedDto
  subcategory?: InventoryCategoryNestedDto | null
}

/** Movement row for tables populated via `serializeForClient` from Prisma. */
export type InventoryMovementClientRow = {
  id: string
  movementType: string
  quantity: number
  unitCost: number
  totalCost?: number
  createdAt: string
  itemId?: string
  item: { id?: string; sku: string; name: string; unit: string }
  fromLocation?: { name: string; type?: string } | null
  toLocation?: { name: string; type?: string } | null
  project?: { name: string; projectNumber: string } | null
  wbsNode?: { code: string; name: string } | null
  createdBy?: { user?: { fullName: string | null } | null } | null
  projectId?: string | null
  idempotencyKey?: string | null
}
