import { prisma } from '@repo/database'
import type { DocumentTemplate } from '@/lib/pdf/document-template'
import { getOrgContext } from '@/lib/org-context'
import {
  assertProjectAccess,
  canViewProjectSchedule,
} from '@/lib/project-permissions'

/**
 * PDF tabular del cronograma (`build-schedule-print-html` + `/api/pdf`).
 *
 * Query típicos: `id` (scheduleId), `locale`, `from`/`to` (YYYY-MM-DD, filtra tareas que
 * intersectan el rango), `mode=table|view` (vista Gantt estática en HTML si `view`),
 * `showEmitidoPor`, `showFullCompanyData`.
 * Salida: **A4 apaisado** (landscape) para más columnas; pie y numeración compartidos con otros PDF HTML (`render-pdf.ts`).
 */
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
      select: { id: true, projectId: true },
    })
    if (!schedule) {
      throw new Error('Cronograma no encontrado o sin acceso')
    }

    const org = await getOrgContext(session.userId)
    if (!org || org.orgId !== session.orgId) {
      throw new Error('No autorizado')
    }

    let projectRole: string | null
    try {
      ;({ projectRole } = await assertProjectAccess(schedule.projectId, org))
    } catch {
      throw new Error('Cronograma no encontrado o sin acceso')
    }

    if (!canViewProjectSchedule(projectRole)) {
      throw new Error('Cronograma no encontrado o sin acceso')
    }
  },
}
