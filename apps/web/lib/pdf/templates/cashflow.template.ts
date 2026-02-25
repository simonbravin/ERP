import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

export const cashflowTemplate: DocumentTemplate = {
  id: 'cashflow',

  buildPrintUrl({ baseUrl, locale, query }) {
    const path = `/${locale}/print/cashflow`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName() {
    return 'cashflow-consolidado.pdf'
  },

  async validateAccess({ session }) {
    if (!session.orgId) {
      throw new Error('Sin acceso a organización')
    }
  },
}
