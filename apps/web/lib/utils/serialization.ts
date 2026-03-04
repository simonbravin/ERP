/**
 * Serialization utilities for data returned from Prisma (Decimal, Date) to be
 * safe for JSON and React (number, string). Use before returning from Server
 * Actions to the client so typecheck and runtime are consistent.
 */

/** Prisma Decimal-like (has toNumber()). */
type DecimalLike = { toNumber?: () => number }

/**
 * Converts a value that may be Prisma Decimal, number, string, or null/undefined
 * to a number. Safe for monetary and quantity fields.
 */
export function safeDecimal(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  const d = value as DecimalLike
  if (typeof d?.toNumber === 'function') return d.toNumber()
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Converts a value to a number for JSON/client, or returns undefined if null/undefined.
 */
export function safeDecimalOptional(value: unknown): number | undefined {
  if (value == null) return undefined
  const n = safeDecimal(value)
  return n
}

/**
 * Recursively converts an object so that any Prisma Decimal fields become number.
 * Dates are converted to ISO string so they are JSON-serializable.
 * Use for any Prisma result before returning to the client.
 */
export function serializeForClient<T>(obj: T): Serialized<T> {
  if (obj == null) return obj as Serialized<T>
  if (typeof obj === 'number' && Number.isFinite(obj)) return obj as Serialized<T>
  if (typeof obj === 'string' || typeof obj === 'boolean') return obj as Serialized<T>
  if (typeof obj === 'bigint') return Number(obj) as Serialized<T>
  if (obj instanceof Date) return obj.toISOString() as Serialized<T>
  const dec = obj as DecimalLike
  if (typeof dec?.toNumber === 'function') return dec.toNumber() as Serialized<T>
  if (Array.isArray(obj)) return obj.map((item) => serializeForClient(item)) as Serialized<T>
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = serializeForClient(v)
    }
    return out as Serialized<T>
  }
  return obj as Serialized<T>
}

/** Result type: Decimal -> number, Date -> string, nested objects serialized. */
export type Serialized<T> = T extends { toNumber(): number }
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T

/**
 * Serialize only known monetary/quantity keys on an object (shallow).
 * Use when you have a known list of Decimal fields.
 */
export function serializeMonetaryFields<T extends Record<string, unknown>>(
  obj: T,
  keys: (keyof T)[]
): { [K in keyof T]: K extends string ? (T[K] extends unknown ? number | T[K] : T[K]) : T[K] } {
  const out = { ...obj }
  for (const key of keys) {
    const v = obj[key]
    if (v != null && typeof (v as DecimalLike)?.toNumber === 'function') {
      (out as Record<string, unknown>)[key as string] = (v as DecimalLike).toNumber!()
    } else if (v != null && typeof v === 'number') {
      (out as Record<string, unknown>)[key as string] = v
    } else if (v != null && typeof v === 'string') {
      const num = Number(v) as number
      (out as Record<string, unknown>)[key as string] = Number.isFinite(num) ? num : 0
    }
  }
  return out as { [K in keyof T]: K extends string ? (T[K] extends unknown ? number | T[K] : T[K]) : T[K] }
}
