import type { DocumentTemplate } from '@/lib/pdf/document-template'
import { computoTemplate } from './computo.template'
import { transactionsTemplate } from './transactions.template'

export const documentTemplates = {
  computo: computoTemplate,
  transactions: transactionsTemplate,
} as const

export type DocumentTemplateId = keyof typeof documentTemplates

/**
 * Returns the document template for the given id.
 * @throws Error if the template is not registered (e.g. "Unknown document template: xyz")
 */
export function getDocumentTemplate(id: string): DocumentTemplate {
  const template = documentTemplates[id as DocumentTemplateId]
  if (!template) {
    throw new Error(`Unknown document template: ${id}`)
  }
  return template
}
