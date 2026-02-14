import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
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

  const versions = await listBudgetVersions(projectId)
  const canEdit = hasMinimumRole(org.role, 'EDITOR')

  return (
    <div className="erp-view-container space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← {project.name}
        </Link>
      </div>
      <BudgetVersionListClient
        projectId={projectId}
        versions={versions ?? []}
        canEdit={canEdit}
      />
    </div>
  )
}
