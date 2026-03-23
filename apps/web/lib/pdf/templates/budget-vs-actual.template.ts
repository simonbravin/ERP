import type { DocumentTemplate } from '@/lib/pdf/document-template'

export const budgetVsActualTemplate: DocumentTemplate = {
  id: 'budget-vs-actual',

  buildPrintUrl({ baseUrl, locale, query }) {
    const path = `/${locale}/print/budget-vs-actual`
    const url = new URL(path, baseUrl)
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    return url.toString()
  },

  getFileName() {
    return 'presupuesto-vs-real.pdf'
  },

  async validateAccess({ session }) {
    if (!session.orgId) throw new Error('Sin acceso a organización')
  },
}
