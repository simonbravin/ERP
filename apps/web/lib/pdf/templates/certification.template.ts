import { prisma } from '@repo/database'
import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

export const certificationTemplate: DocumentTemplate = {
  id: 'certification',

  buildPrintUrl({ baseUrl, locale, id, query }) {
    if (!id) throw new Error('certification template requires id (projectId)')
    const path = `/${locale}/print/certification/${id}`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName({ id }) {
    return id ? `certificaciones-${id}.pdf` : 'certificaciones.pdf'
  },

  async validateAccess({ session, id }) {
    if (!id) throw new Error('certification template requires id (projectId)')
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.orgId },
      select: { id: true },
    })
    if (!project) {
      throw new Error('Proyecto no encontrado o sin acceso')
    }
  },
}
