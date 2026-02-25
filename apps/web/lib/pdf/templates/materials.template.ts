import { prisma } from '@repo/database'
import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

export const materialsTemplate: DocumentTemplate = {
  id: 'materials',

  buildPrintUrl({ baseUrl, locale, id, query }) {
    if (!id) throw new Error('materials template requires id (versionId)')
    const path = `/${locale}/print/materials/${id}`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName({ id }) {
    return id ? `materiales-${id}.pdf` : 'materiales.pdf'
  },

  async validateAccess({ session, id }) {
    if (!id) throw new Error('materials template requires id (versionId)')
    const version = await prisma.budgetVersion.findFirst({
      where: { id, orgId: session.orgId },
      select: { id: true },
    })
    if (!version) {
      throw new Error('Versión no encontrada o sin acceso')
    }
  },
}
