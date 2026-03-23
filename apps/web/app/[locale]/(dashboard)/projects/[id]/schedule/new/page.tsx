import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProject } from '@/app/actions/projects'
import { hasMinimumRole } from '@/lib/rbac'
import { assertProjectAccess, canViewProjectSchedule } from '@/lib/project-permissions'
import { canEditSchedule } from '@/lib/schedule-permissions'
import { NewScheduleForm } from '@/components/schedule/new-schedule-form'
import { getLocale, getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@repo/database'
import { format } from 'date-fns'
import { enUS, es } from 'date-fns/locale'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string }>
}

export default async function NewSchedulePage({ params, searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) notFound()

  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  let projectRole: string | null
  try {
    ;({ projectRole } = await assertProjectAccess(projectId, org))
  } catch {
    notFound()
  }
  if (!canViewProjectSchedule(projectRole)) notFound()
  if (!hasMinimumRole(org.role, 'EDITOR')) notFound()
  if (!canEditSchedule(org, projectRole)) notFound()

  const initialStartDate =
    project.startDate instanceof Date
      ? project.startDate.toISOString().slice(0, 10)
      : project.startDate
        ? new Date(project.startDate).toISOString().slice(0, 10)
        : null
  const plannedEndDate =
    project.plannedEndDate instanceof Date
      ? project.plannedEndDate.toISOString().slice(0, 10)
      : project.plannedEndDate
        ? new Date(project.plannedEndDate).toISOString().slice(0, 10)
        : null

  const sp = searchParams ? await searchParams : {}
  const fromScheduleId =
    typeof sp.from === 'string' && sp.from.length > 0 ? sp.from : null

  let duplicateFromScheduleId: string | null = null
  let defaultRevisionName: string | null = null
  let duplicateSourceLabel: string | null = null
  let duplicateStartDate: string | null = null

  if (fromScheduleId) {
    const src = await prisma.schedule.findFirst({
      where: {
        id: fromScheduleId,
        projectId,
        orgId: org.orgId,
      },
      select: {
        id: true,
        name: true,
        projectStartDate: true,
      },
    })
    if (src) {
      duplicateFromScheduleId = src.id
      duplicateSourceLabel = src.name
      duplicateStartDate = src.projectStartDate.toISOString().slice(0, 10)
    }
  }

  const t = await getTranslations('schedule')
  const locale = await getLocale()
  const dateLocale = locale.startsWith('es') ? es : enUS
  if (duplicateFromScheduleId && duplicateSourceLabel) {
    defaultRevisionName = t('defaultRevisionName', {
      source: duplicateSourceLabel,
      date: format(new Date(), 'P', { locale: dateLocale }),
    })
  }

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">
            {duplicateFromScheduleId ? t('newRevisionFromPlanTitle') : t('createNewSchedule')}
          </h1>
          <p className="erp-section-desc">{project.name}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${projectId}/schedule`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToSchedule')}
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6 min-w-0">
        <NewScheduleForm
          key={duplicateFromScheduleId ?? 'wbs'}
          projectId={projectId}
          initialStartDate={duplicateStartDate ?? initialStartDate}
          plannedEndDate={plannedEndDate}
          duplicateFromScheduleId={duplicateFromScheduleId}
          defaultRevisionName={defaultRevisionName}
          duplicateSourceLabel={duplicateSourceLabel}
        />
      </div>
    </div>
  )
}
