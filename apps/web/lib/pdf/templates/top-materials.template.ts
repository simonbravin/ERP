import type { DocumentTemplate } from '@/lib/pdf/document-template'

export const topMaterialsTemplate: DocumentTemplate = {
  id: 'top-materials',

  buildPrintUrl({ baseUrl, locale, query }) {
    const path = `/${locale}/print/top-materials`
    const url = new URL(path, baseUrl)
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    return url.toString()
  },

  getFileName() {
    return 'top-10-materiales.pdf'
  },

  async validateAccess({ session }) {
    if (!session.orgId) throw new Error('Sin acceso a organización')
  },
}
