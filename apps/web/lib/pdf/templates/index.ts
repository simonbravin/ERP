import type { DocumentTemplates, DocumentTemplate } from '@/lib/pdf/document-template'
import { computoTemplate } from './computo.template'

export const documentTemplates: Partial<Record<DocumentTemplates, DocumentTemplate>> = {
  computo: computoTemplate,
}

/**
 * Returns the document template for the given id.
 * @throws Error if the template is not registered (e.g. "Unknown document template: xyz")
 */
export function getDocumentTemplate(id: string): DocumentTemplate {
  const template = documentTemplates[id as DocumentTemplates]
  if (!template) {
    throw new Error(`Unknown document template: ${id}`)
  }
  return template
}
