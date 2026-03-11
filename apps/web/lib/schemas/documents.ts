import { z } from 'zod'

const DOC_TYPES = ['CONTRACT', 'DRAWING', 'SPEC', 'PHOTO', 'REPORT', 'INVOICE', 'CERTIFICATE', 'OTHER'] as const

/** Validación para datos extraídos del FormData de createDocument */
export const createDocumentFormSchema = z.object({
  title: z.string().max(500).optional(),
  docType: z.enum(DOC_TYPES, { message: 'Tipo de documento inválido' }),
  projectId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
    z.string().uuid().optional()
  ),
  folderId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
    z.string().uuid().optional()
  ),
})

export function parseCreateDocumentForm(data: {
  title?: string
  docType?: string
  projectId?: string | null
  folderId?: string | null
}): { success: true; data: { title: string; docType: string; projectId?: string; folderId?: string } } | { success: false; error: string } {
  const parsed = createDocumentFormSchema.safeParse({
    title: (data.title ?? '').trim() || undefined,
    docType: data.docType ?? undefined,
    projectId: (data.projectId ?? '').trim() || undefined,
    folderId: (data.folderId ?? '').trim() || undefined,
  })
  if (parsed.success) {
    const d = parsed.data
    return {
      success: true,
      data: {
        title: (d.title && d.title.trim()) || 'Documento',
        docType: d.docType,
        projectId: d.projectId,
        folderId: d.folderId,
      },
    }
  }
  const msg = parsed.error.flatten().formErrors[0]
  return { success: false, error: msg ?? 'Datos inválidos' }
}
