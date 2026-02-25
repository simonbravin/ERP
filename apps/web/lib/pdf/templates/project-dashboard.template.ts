import { prisma } from '@repo/database'
import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

export const projectDashboardTemplate: DocumentTemplate = {
  id: 'project-dashboard',

  buildPrintUrl({ baseUrl, locale, id }) {
    if (!id) throw new Error('project-dashboard template requires id (projectId)')
    const path = `/${locale}/print/project-dashboard/${id}`
    return new URL(path, baseUrl).toString()
  },

  getFileName({ id }) {
    return id ? `dashboard-proyecto-${id}.pdf` : 'dashboard-proyecto.pdf'
  },

  async validateAccess({ session, id }) {
    if (!id) throw new Error('project-dashboard template requires id (projectId)')
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.orgId },
      select: { id: true },
    })
    if (!project) throw new Error('Proyecto no encontrado o sin acceso')
  },
}
