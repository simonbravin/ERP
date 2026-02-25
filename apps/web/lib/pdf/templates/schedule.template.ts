import { prisma } from '@repo/database'
import type { DocumentTemplate, DocumentTemplateSession } from '@/lib/pdf/document-template'

export const scheduleTemplate: DocumentTemplate = {
  id: 'schedule',

  buildPrintUrl({ baseUrl, locale, id, query }) {
    if (!id) throw new Error('schedule template requires id (scheduleId)')
    const path = `/${locale}/print/schedule/${id}`
    const url = new URL(path, baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    return url.toString()
  },

  getFileName({ id }) {
    return id ? `cronograma-${id}.pdf` : 'cronograma.pdf'
  },

  async validateAccess({ session, id }) {
    if (!id) throw new Error('schedule template requires id (scheduleId)')
    const schedule = await prisma.schedule.findFirst({
      where: { id, orgId: session.orgId },
      select: { id: true },
    })
    if (!schedule) {
      throw new Error('Cronograma no encontrado o sin acceso')
    }
  },
}
