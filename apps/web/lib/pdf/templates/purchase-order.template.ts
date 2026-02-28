import { prisma } from '@repo/database'
import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

export const purchaseOrderTemplate: DocumentTemplate = {
  id: 'purchase-order',

  buildPrintUrl({ baseUrl, locale, id, query }) {
    if (!id) throw new Error('purchase-order template requires id (commitmentId)')
    const path = `/${locale}/print/purchase-order/${id}`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName({ id }) {
    return id ? `orden-compra-${id}.pdf` : 'orden-compra.pdf'
  },

  async validateAccess({ session, id }) {
    if (!id) throw new Error('purchase-order template requires id (commitmentId)')
    const commitment = await prisma.commitment.findFirst({
      where: { id, orgId: session.orgId, deleted: false },
      select: { id: true },
    })
    if (!commitment) {
      throw new Error('Orden de compra no encontrada o sin acceso')
    }
  },
}
