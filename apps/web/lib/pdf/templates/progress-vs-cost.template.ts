import type { DocumentTemplate } from '@/lib/pdf/document-template'

export const progressVsCostTemplate: DocumentTemplate = {
  id: 'progress-vs-cost',

  buildPrintUrl({ baseUrl, locale, query }) {
    const path = `/${locale}/print/progress-vs-cost`
    const url = new URL(path, baseUrl)
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    return url.toString()
  },

  getFileName() {
    return 'avance-vs-costo.pdf'
  },

  async validateAccess({ session }) {
    if (!session.orgId) throw new Error('Sin acceso a organización')
  },
}
