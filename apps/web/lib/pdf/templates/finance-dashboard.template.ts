import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

export const financeDashboardTemplate: DocumentTemplate = {
  id: 'finance-dashboard',

  buildPrintUrl({ baseUrl, locale }) {
    const path = `/${locale}/print/finance-dashboard`
    return new URL(path, baseUrl).toString()
  },

  getFileName() {
    return 'dashboard-finanzas.pdf'
  },

  async validateAccess({ session }) {
    if (!session.orgId) throw new Error('Sin acceso a organización')
  },
}
