import { serializeForClient } from '@/lib/utils/serialization'
import type { InventoryItemFormDto, InventoryMovementClientRow } from '@/lib/types/inventory-dto'

/** Serialize a Prisma inventory item (with includes) for `ItemForm` / client props. */
export function toInventoryItemFormDto(item: unknown): InventoryItemFormDto {
  return serializeForClient(item) as InventoryItemFormDto
}

/** Serialize movement rows for movement tables and history components. */
export function toInventoryMovementClientRows(rows: unknown[]): InventoryMovementClientRow[] {
  return rows.map((row) => serializeForClient(row) as InventoryMovementClientRow)
}
