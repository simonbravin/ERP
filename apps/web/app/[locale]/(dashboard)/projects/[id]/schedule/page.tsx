import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { assertProjectAccess, canViewProjectSchedule } from '@/lib/project-permissions'
import { hasMinimumRole } from '@/lib/rbac'
import { canEditSchedule } from '@/lib/schedule-permissions'
import { getLocale } from 'next-intl/server'
import { prisma } from '@repo/database'
import { ScheduleView } from '@/components/schedule/schedule-view'
import { Button } from '@/components/ui/button'
import { Copy, Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { parseScheduleId } from '@/lib/schemas/schedule'
import { ScheduleVersionSelector } from '@/components/schedule/schedule-version-selector'

export default async function ProjectSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ schedule?: string }>
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

  let projectRole: string | null
  try {
    ;({ projectRole } = await assertProjectAccess(id, orgContext))
  } catch {
    notFound()
  }
  if (!canViewProjectSchedule(projectRole)) {
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

  const projectRoleForEmpty = projectRole
  const canCreateSchedule =
    hasMinimumRole(orgContext.role, 'EDITOR') &&
    canEditSchedule(orgContext, projectRoleForEmpty)

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

  // Prefer a DRAFT version for editing when one exists; otherwise baseline / first.
  const defaultSchedule =
    schedules.find((s) => s.status === 'DRAFT') ??
    schedules.find((s) => s.isBaseline) ??
    schedules[0]

  const sp = searchParams ? await searchParams : {}
  const requestedScheduleParam =
    typeof sp.schedule === 'string' && sp.schedule.length > 0 ? sp.schedule : null
  let activeSchedule = defaultSchedule
  if (requestedScheduleParam) {
    const parsed = parseScheduleId(requestedScheduleParam)
    if (parsed.success) {
      const found = schedules.find((s) => s.id === parsed.scheduleId)
      if (found) activeSchedule = found
    }
  }

  const canMutateSchedule = canEditSchedule(orgContext, projectRole)
  const canEdit = canMutateSchedule && activeSchedule.status === 'DRAFT'
  const canCreateVersion = canMutateSchedule
  const showRevisionFromPlan =
    canCreateVersion && activeSchedule.status !== 'DRAFT'
  const tSchedule = await getTranslations('schedule')

  const versionOptions = schedules.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    isBaseline: s.isBaseline,
    taskCount: s._count.tasks,
  }))

  return (
    <div className="erp-stack">
      <div className="erp-header-row flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <ScheduleVersionSelector
          projectId={id}
          schedules={versionOptions}
          activeScheduleId={activeSchedule.id}
          defaultScheduleId={defaultSchedule.id}
        />
        {canCreateVersion && (
          <div className="erp-header-actions flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {showRevisionFromPlan && (
              <Button variant="secondary" asChild>
                <Link href={`/projects/${id}/schedule/new?from=${activeSchedule.id}`}>
                  <Copy className="mr-2 h-4 w-4" />
                  {tSchedule('newRevisionFromPlan')}
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href={`/projects/${id}/schedule/new`}>
                <Plus className="mr-2 h-4 w-4" />
                {tSchedule('newVersion')}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <ScheduleView
        scheduleId={activeSchedule.id}
        canEdit={canEdit}
        canSetBaseline={['ADMIN', 'OWNER'].includes(orgContext.role)}
        canCreateVersion={canCreateVersion}
      />
    </div>
  )
}
