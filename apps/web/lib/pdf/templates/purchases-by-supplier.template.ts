import { prisma } from '@repo/database'
import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

export const purchasesBySupplierTemplate: DocumentTemplate = {
  id: 'purchases-by-supplier',

  buildPrintUrl({ baseUrl, locale, query }) {
    const path = `/${locale}/print/purchases-by-supplier`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName() {
    return 'compras-por-proveedor.pdf'
  },

  async validateAccess({ session }) {
    if (!session.orgId) throw new Error('Sin acceso a organización')
  },
}
