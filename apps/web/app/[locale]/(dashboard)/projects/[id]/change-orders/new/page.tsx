import { notFound } from 'next/navigation'
import Link from 'next/link'
import { redirectTo } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { createChangeOrder } from '@/app/actions/change-orders'
import { getWbsNodesForProject } from '@/app/actions/daily-reports'
import { COForm } from '@/components/change-orders/co-form'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function NewChangeOrderPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const canEdit = hasMinimumRole(org.role, 'EDITOR')
  if (!canEdit) notFound()

  const wbsOptions = await getWbsNodesForProject(projectId)

  async function onSubmit(data: Parameters<typeof createChangeOrder>[1]) {
    'use server'
    const result = await createChangeOrder(projectId, data)
    if (result && 'success' in result && 'changeOrderId' in result && result.changeOrderId) {
      return redirectTo(`/projects/${projectId}/change-orders/${result.changeOrderId}`)
    }
    return result
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/projects/${projectId}/change-orders`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← {project.name} — Órdenes de cambio
        </Link>
      </div>
      <h1 className="erp-page-title mb-4">
        Nueva orden de cambio
      </h1>
      <COForm
        mode="create"
        projectId={projectId}
        wbsOptions={wbsOptions}
        onSubmit={onSubmit}
        onCancelHref={`/projects/${projectId}/change-orders`}
      />
    </div>
  )
}
