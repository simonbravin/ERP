import type { DocumentTemplate } from '@/lib/pdf/document-template'

export const gastosPorProveedorTemplate: DocumentTemplate = {
  id: 'gastos-por-proveedor',

  buildPrintUrl({ baseUrl, locale, query }) {
    const path = `/${locale}/print/gastos-por-proveedor`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName() {
    return 'gastos-por-proveedor.pdf'
  },

  async validateAccess({ session }) {
    if (!session.orgId) throw new Error('Sin acceso a organización')
  },
}
