import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getLocale } from 'next-intl/server'
import { prisma } from '@repo/database'
import { ScheduleView } from '@/components/schedule/schedule-view'
import { Button } from '@/components/ui/button'
import { Plus, ArrowLeft } from 'lucide-react'
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

  if (schedules.length === 0) {
    return (
      <div className="erp-view-container space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Proyecto
          </Link>
        </Button>

        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12">
          <h2 className="erp-page-title">No hay cronogramas aún</h2>
          <p className="mt-2 text-center erp-section-desc">
            Crea el primer cronograma para este proyecto basado en la estructura
            WBS
          </p>

          {['EDITOR', 'ADMIN', 'OWNER'].includes(orgContext.role) && (
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

  const projectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_orgMemberId: {
        projectId: id,
        orgMemberId: orgContext.memberId,
      },
    },
    select: { projectRole: true },
  })

  const canEditByOrg = ['EDITOR', 'ADMIN', 'OWNER'].includes(orgContext.role)
  const canEditByProjectRole =
    projectMember?.projectRole &&
    ['MANAGER', 'SUPERINTENDENT'].includes(projectMember.projectRole)
  const canEdit =
    (canEditByOrg || !!canEditByProjectRole) &&
    activeSchedule.status === 'DRAFT'

  return (
    <div className="erp-view-container space-y-6">
      <div className="erp-header-row">
        <div className="erp-section-header">
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href={`/projects/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Proyecto
            </Link>
          </Button>
          <h1 className="erp-page-title">{project.name}</h1>
          <p className="erp-section-desc">Cronograma: {activeSchedule.name}</p>
        </div>

        {['EDITOR', 'ADMIN', 'OWNER'].includes(orgContext.role) && (
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
