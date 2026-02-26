import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProject } from '@/app/actions/projects'
import { canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { getProjectMemberRole } from '@/lib/project-context'
import { NewScheduleForm } from '@/components/schedule/new-schedule-form'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function NewSchedulePage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) notFound()

  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const projectRole = await getProjectMemberRole(projectId, org.memberId)
  const canEdit =
    ['EDITOR', 'ADMIN', 'OWNER'].includes(org.role) ||
    canEditProjectArea(projectRole, PROJECT_AREAS.SCHEDULE)
  if (!canEdit) notFound()

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

  return (
    <NewScheduleForm
      projectId={projectId}
      initialStartDate={initialStartDate}
      plannedEndDate={plannedEndDate}
    />
  )
}
