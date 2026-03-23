import { z } from 'zod'

const uuidSchema = z.string().uuid()

/**
 * Valida que un ID sea un UUID válido.
 * Útil para projectId, certId, rfiId, documentId, etc. en server actions.
 */
export function parseUuid(
  value: string,
  fieldName: string = 'ID'
): { success: true; value: string } | { success: false; error: string } {
  const result = uuidSchema.safeParse(value)
  if (result.success) return { success: true, value: result.data }
  return { success: false, error: `${fieldName} inválido` }
}

/** Human-readable error or `undefined` if valid — avoids TS narrowing issues with `!result.success`. */
export function parseUuidErrorMessage(result: ReturnType<typeof parseUuid>): string | undefined {
  if (result.success === false) return result.error
  return undefined
}

/**
 * Valid UUID or throws — use in server actions that already propagate errors via try/catch.
 * Prefer this over `if (!parseUuid(...).success) throw` so TypeScript narrows correctly.
 */
export function parseUuidOrThrow(value: string, fieldName?: string): string {
  const r = parseUuid(value, fieldName)
  if (r.success === false) throw new Error(r.error)
  return r.value
}

export const projectIdSchema = z.object({ projectId: z.string().uuid() })
export const uuidSchemaExport = uuidSchema
