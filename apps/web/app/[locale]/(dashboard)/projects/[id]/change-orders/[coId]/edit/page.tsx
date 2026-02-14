import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { getChangeOrder } from '@/app/actions/change-orders'
import { getWbsNodesForProject } from '@/app/actions/daily-reports'
import { COForm } from '@/components/change-orders/co-form'

type PageProps = {
  params: Promise<{ id: string; coId: string }>
}

function toDateOnly(d: Date | null | undefined): Date | undefined {
  if (!d) return undefined
  const x = d instanceof Date ? d : new Date(d)
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), 12, 0, 0, 0))
}

export default async function ChangeOrderEditPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId, coId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const co = await getChangeOrder(coId)
  if (!co || co.project.id !== projectId) notFound()

  const canEdit = hasMinimumRole(org.role, 'EDITOR')
  const isEditable = co.status === 'DRAFT' || co.status === 'CHANGES_REQUESTED'
  if (!canEdit || !isEditable) notFound()

  const wbsOptions = await getWbsNodesForProject(projectId)

  const defaultValues = {
    title: co.title,
    reason: co.reason,
    justification: co.justification ?? undefined,
    changeType: co.changeType,
    budgetImpactType: (co as { budgetImpactType?: string }).budgetImpactType ?? 'DEVIATION',
    costImpact: Number(co.costImpact),
    timeImpactDays: co.timeImpactDays ?? 0,
    requestDate: toDateOnly(co.requestDate),
    implementedDate: toDateOnly(co.implementedDate),
    lines: co.lines.map((l) => ({
      wbsNodeId: l.wbsNodeId,
      changeType: l.changeType as 'ADD' | 'MODIFY' | 'DELETE',
      justification: l.justification,
      deltaCost: Number(l.deltaCost),
    })),
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href={`/projects/${projectId}/change-orders/${coId}`}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← {co.displayNumber}
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link
            href={`/projects/${projectId}/change-orders`}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Órdenes de cambio
          </Link>
        </div>
        <h1 className="erp-page-title mb-4">Editar orden de cambio</h1>
        <div className="mt-6">
          <COForm
            mode="edit"
            projectId={projectId}
            defaultValues={defaultValues}
            wbsOptions={wbsOptions}
            coId={coId}
            onCancelHref={`/projects/${projectId}/change-orders/${coId}`}
          />
        </div>
      </div>
    </div>
  )
}
