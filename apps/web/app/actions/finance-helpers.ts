/**
 * Shared non-async helpers for the finance domain.
 * Kept separate from 'use server' files since Next.js only allows
 * async function exports in server action modules.
 */

export function isEditableStatus(status: string): boolean {
  return status === 'DRAFT'
}

export function toNum(v: unknown): number {
  if (v == null) return 0
  const d = v as { toNumber?: () => number }
  if (typeof d?.toNumber === 'function') return d.toNumber()
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Serialized transaction row: monetary fields as number for client/JSON. */
export type SerializedTransactionRow<T> = Omit<T, 'total' | 'subtotal' | 'taxTotal' | 'amountBaseCurrency' | 'retentionAmount' | 'adjustmentAmount'> & {
  total: number
  subtotal: number
  taxTotal: number
  amountBaseCurrency: number
  retentionAmount?: number
  adjustmentAmount?: number
}

export function serializeTransaction<T extends {
  total?: unknown
  subtotal?: unknown
  taxTotal?: unknown
  amountBaseCurrency?: unknown
  retentionAmount?: unknown
  adjustmentAmount?: unknown
}>(
  t: T
): SerializedTransactionRow<T> {
  return {
    ...t,
    total: toNum(t.total),
    subtotal: toNum(t.subtotal),
    taxTotal: toNum(t.taxTotal),
    amountBaseCurrency: toNum(t.amountBaseCurrency),
    ...(('retentionAmount' in t && t.retentionAmount != null) ? { retentionAmount: toNum(t.retentionAmount) } : {}),
    ...(('adjustmentAmount' in t && t.adjustmentAmount != null) ? { adjustmentAmount: toNum(t.adjustmentAmount) } : {}),
  } as SerializedTransactionRow<T>
}
