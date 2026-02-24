import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProjectMemberRole } from '@/lib/project-context'
import { canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { listBudgetVersions } from '@/app/actions/budget'
import { BudgetVersionListClient } from '@/components/budget/budget-version-list-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectBudgetPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const [versions, projectRole] = await Promise.all([
    listBudgetVersions(projectId),
    getProjectMemberRole(projectId, org.memberId),
  ])
  const canEdit =
    hasMinimumRole(org.role, 'EDITOR') ||
    canEditProjectArea(projectRole, PROJECT_AREAS.BUDGET)

  return (
    <div className="erp-stack">
      <BudgetVersionListClient
        projectId={projectId}
        versions={versions ?? []}
        canEdit={canEdit}
      />
    </div>
  )
}
