import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProjectMemberRole } from '@/lib/project-context'
import { canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { getLocale } from 'next-intl/server'
import { prisma } from '@repo/database'
import { ScheduleView } from '@/components/schedule/schedule-view'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'

export default async function ProjectSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  const locale = await getLocale()
  const { id } = await params

  if (!session?.user?.id) {
    redirect(`/${locale}/login`)
  }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) {
    redirect(`/${locale}/login`)
  }

  const project = await prisma.project.findFirst({
    where: { id, orgId: orgContext.orgId },
    select: { id: true, name: true, projectNumber: true },
  })

  if (!project) {
    notFound()
  }

  // Ensure Prisma client has Schedule model (run: pnpm --filter @repo/database db:generate)
  const scheduleDelegate = prisma?.schedule
  if (!scheduleDelegate) {
    throw new Error(
      'Prisma client missing Schedule model. Stop the dev server and run: pnpm --filter @repo/database db:generate'
    )
  }

  const schedules = await scheduleDelegate.findMany({
    where: { projectId: id, orgId: orgContext.orgId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: {
          user: { select: { fullName: true } },
        },
      },
      _count: {
        select: { tasks: true },
      },
    },
  })

  const projectRoleForEmpty = await getProjectMemberRole(id, orgContext.memberId)
  const canCreateSchedule =
    ['EDITOR', 'ADMIN', 'OWNER'].includes(orgContext.role) ||
    canEditProjectArea(projectRoleForEmpty, PROJECT_AREAS.SCHEDULE)

  if (schedules.length === 0) {
    return (
      <div className="erp-stack">
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12">
          <h2 className="erp-page-title">No hay cronogramas aún</h2>
          <p className="mt-2 text-center erp-section-desc">
            Crea el primer cronograma para este proyecto basado en la estructura
            WBS
          </p>

          {canCreateSchedule && (
            <Button asChild className="mt-6">
              <Link href={`/projects/${id}/schedule/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Cronograma
              </Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  const activeSchedule =
    schedules.find((s) => s.isBaseline) ?? schedules[0]

  const projectRole = await getProjectMemberRole(id, orgContext.memberId)
  const canEditByOrg = ['EDITOR', 'ADMIN', 'OWNER'].includes(orgContext.role)
  const canEditByProjectRole = canEditProjectArea(projectRole, PROJECT_AREAS.SCHEDULE)
  const canEdit =
    (canEditByOrg || canEditByProjectRole) && activeSchedule.status === 'DRAFT'
  const canCreateVersion = canEditByOrg || canEditByProjectRole

  return (
    <div className="erp-stack">
      <div className="erp-header-row">
        <p className="erp-section-desc">Cronograma: {activeSchedule.name}</p>
        {canCreateVersion && (
          <div className="erp-header-actions">
            <Button asChild>
              <Link href={`/projects/${id}/schedule/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Versión
              </Link>
            </Button>
          </div>
        )}
      </div>

      <ScheduleView
        scheduleId={activeSchedule.id}
        canEdit={canEdit}
        canSetBaseline={['ADMIN', 'OWNER'].includes(orgContext.role)}
      />
    </div>
  )
}
