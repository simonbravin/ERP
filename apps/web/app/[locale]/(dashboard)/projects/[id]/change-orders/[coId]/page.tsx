import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import {
  getChangeOrder,
  approveChangeOrder,
  rejectChangeOrder,
  requestChanges,
  submitForApproval,
} from '@/app/actions/change-orders'
import { ApprovalTimeline, type ApprovalEntry } from '@/components/change-orders/approval-timeline'
import { ChangeOrderDetailClient } from '@/components/change-orders/change-order-detail-client'
import { BudgetImpactBadge } from '@/components/change-orders/budget-impact-badge'
import { ChangeTypeLabel } from '@/components/change-orders/change-type-label'
import { cn } from '@/lib/utils'

type PageProps = {
  params: Promise<{ id: string; coId: string }>
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    dateStyle: 'medium',
  })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'badge-neutral',
    SUBMITTED: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-danger',
    CHANGES_REQUESTED: 'badge-info',
  }
  return (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', styles[status] ?? 'badge-neutral')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}


export default async function ChangeOrderDetailPage({ params }: PageProps) {
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
  const canApprove = hasMinimumRole(org.role, 'ADMIN')
  const isEditable = (co.status === 'DRAFT' || co.status === 'CHANGES_REQUESTED') && canEdit
  const canSubmit = isEditable && (co.status === 'DRAFT' || co.status === 'CHANGES_REQUESTED')

  const approvalEntries: ApprovalEntry[] = co.approvals.map((a) => ({
    id: a.id,
    decision: a.decision,
    comment: a.comment ?? null,
    createdAt: a.createdAt,
    orgMember: { user: { fullName: a.orgMember.user.fullName } },
  }))

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href={`/projects/${projectId}/change-orders`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← Change orders
        </Link>
        <span className="text-gray-400">|</span>
        <Link
          href={`/projects/${projectId}`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {project.name}
        </Link>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {co.displayNumber} — {co.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Requested by {co.requestedBy.user.fullName} on {formatDate(co.requestDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={co.status} />
            <BudgetImpactBadge type={(co as { budgetImpactType?: string }).budgetImpactType ?? 'DEVIATION'} />
            {isEditable && (
              <Link
                href={`/projects/${projectId}/change-orders/${coId}/edit`}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Edit
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Reason</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{co.reason}</dd>
            </div>
            {co.justification && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Justification</dt>
                <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{co.justification}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Tipo de cambio</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                <ChangeTypeLabel type={co.changeType} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Impacto en costo</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {formatCurrency(co.costImpact)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Días de impacto</dt>
              <dd className="mt-0.5 text-sm text-foreground">{(co as { timeImpactDays?: number }).timeImpactDays ?? 0}</dd>
            </div>
          </dl>
          {co.status === 'REJECTED' && co.rejectionReason && (
            <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-xs font-medium uppercase text-red-700 dark:text-red-400">Rejection reason</p>
              <p className="mt-1 text-sm text-red-800 dark:text-red-300">{co.rejectionReason}</p>
            </div>
          )}
          {co.status === 'CHANGES_REQUESTED' && co.feedbackRequested && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-xs font-medium uppercase text-amber-700 dark:text-amber-400">Feedback requested</p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{co.feedbackRequested}</p>
            </div>
          )}
        </div>

        {co.lines.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
              Change order lines
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">WBS</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Justification</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Delta cost</th>
                </tr>
              </thead>
              <tbody>
                {co.lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                      {line.wbsNode?.code ?? '—'} {line.wbsNode?.name ?? ''}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <ChangeTypeLabel type={line.changeType} />
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{line.justification}</td>
                    <td className="text-right tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(Number(line.deltaCost))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {co.status === 'APPROVED' && co.budgetVersion && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Budget version created:{' '}
              <Link
                href={`/projects/${projectId}/budget/${co.budgetVersion.id}`}
                className="underline hover:no-underline"
              >
                {co.budgetVersion.versionCode}
              </Link>
            </p>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Approval history</h3>
          <div className="mt-3">
            <ApprovalTimeline approvals={approvalEntries} />
          </div>
        </div>

        <ChangeOrderDetailClient
          coId={coId}
          status={co.status}
          canSubmit={canSubmit}
          canApprove={canApprove}
          submitForApproval={submitForApproval}
          approveChangeOrder={approveChangeOrder}
          rejectChangeOrder={rejectChangeOrder}
          requestChanges={requestChanges}
        />
      </div>
    </div>
  )
}
