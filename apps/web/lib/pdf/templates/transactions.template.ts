import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

/**
 * Transactions PDF template (REPORT: no resource id, optional query params e.g. from/to).
 * Route: /[locale]/print/transactions
 * validateAccess: org-only for now.
 */
export const transactionsTemplate: DocumentTemplate = {
  id: 'transactions',

  buildPrintUrl({ baseUrl, locale, query }) {
    const path = `/${locale}/print/transactions`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName() {
    return 'transactions.pdf'
  },

  async validateAccess({ session }: { session: DocumentTemplateSession; id?: string }) {
    if (!session.orgId) {
      throw new Error('Sin acceso a organización')
    }
  },
}
