import type { DocumentTemplates, DocumentTemplate } from '@/lib/pdf/document-template'
import { computoTemplate } from './computo.template'
import { transactionsTemplate } from './transactions.template'

export const documentTemplates: Partial<Record<DocumentTemplates, DocumentTemplate>> = {
  computo: computoTemplate,
  transactions: transactionsTemplate,
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
