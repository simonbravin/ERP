import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

/**
 * Transactions PDF template.
 * Future route: /[locale]/print/transactions
 * validateAccess: org-only for now (no resource id).
 */
export const transactionsTemplate: DocumentTemplate = {
  id: 'transactions',

  buildPrintUrl({ baseUrl, locale, id, query }) {
    const path = id
      ? `/${locale}/print/transactions/${id}`
      : `/${locale}/print/transactions`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName({ id }) {
    return id ? `transactions-${id}.pdf` : 'transactions.pdf'
  },

  async validateAccess({ session }: { session: DocumentTemplateSession; id?: string }) {
    if (!session.orgId) {
      throw new Error('Sin acceso a organización')
    }
  },
}
