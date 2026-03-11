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

export const projectIdSchema = z.object({ projectId: z.string().uuid() })
export const uuidSchemaExport = uuidSchema
