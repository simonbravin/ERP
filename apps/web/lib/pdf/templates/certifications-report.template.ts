import type { DocumentTemplate } from '@/lib/pdf/document-template'

export const certificationsReportTemplate: DocumentTemplate = {
  id: 'certifications-report',

  buildPrintUrl({ baseUrl, locale, query }) {
    const path = `/${locale}/print/certifications`
    const url = new URL(path, baseUrl)
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    return url.toString()
  },

  getFileName() {
    return 'certificaciones-por-proyecto.pdf'
  },

  async validateAccess({ session }) {
    if (!session.orgId) throw new Error('Sin acceso a organización')
  },
}
