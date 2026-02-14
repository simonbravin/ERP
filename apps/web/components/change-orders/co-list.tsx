'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ChangeOrderRow = {
  id: string
  number: number
  displayNumber: string
  title: string
  status: string
  budgetImpactType: string | null
  costImpact: number
  timeImpactDays: number
  requestDate: Date
  requestedBy: { user: { fullName: string } }
}

type COListProps = {
  projectId: string
  orders: ChangeOrderRow[]
  canEdit: boolean
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
  return new Date(d).toLocaleDateString()
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'badge-neutral',
    SUBMITTED: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-danger',
    CHANGES_REQUESTED: 'badge-info',
  }
  return (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', styles[status] ?? 'badge-neutral')}>
      {label}
    </span>
  )
}

function BudgetImpactBadge({ type, label }: { type: string; label: string }) {
  const className = type === 'APPROVED_CHANGE' ? 'badge-success' : 'badge-neutral'
  return (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

export function COList({ projectId, orders, canEdit }: COListProps) {
  const t = useTranslations('changeOrders')
  const tCommon = useTranslations('common')

  if (orders.length === 0) {
    return (
      <div className="erp-panel py-12 text-center text-muted-foreground">
        {t('noChangeOrdersYet')}
      </div>
    )
  }

  const statusLabels: Record<string, string> = {
    DRAFT: t('statusDraft'),
    SUBMITTED: t('statusSubmitted'),
    APPROVED: t('statusApproved'),
    REJECTED: t('statusRejected'),
    CHANGES_REQUESTED: t('statusChangesRequested'),
  }

  const budgetImpactLabels: Record<string, string> = {
    DEVIATION: t('budgetImpactDeviation'),
    APPROVED_CHANGE: t('budgetImpactApproved'),
  }

  return (
    <div className="erp-panel overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('number')}</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('title_field')}</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('requestedBy')}</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('amount')}</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('timeImpactDays')}</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('status')}</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('budgetImpactType')}</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('date')}</th>
            <th className="w-20 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {orders.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-foreground">
                {row.displayNumber}
              </td>
              <td className="px-3 py-2 font-medium text-foreground">{row.title}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {row.requestedBy.user.fullName}
              </td>
              <td className="text-right tabular-nums text-foreground">
                {formatCurrency(row.costImpact)}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {row.timeImpactDays ?? 0}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} label={statusLabels[row.status] ?? row.status.replace('_', ' ')} />
              </td>
              <td className="px-3 py-2">
                <BudgetImpactBadge
                  type={row.budgetImpactType ?? 'DEVIATION'}
                  label={budgetImpactLabels[row.budgetImpactType ?? 'DEVIATION'] ?? row.budgetImpactType ?? 'DEVIATION'}
                />
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatDate(row.requestDate)}
              </td>
              <td className="px-3 py-2">
                <Link href={`/projects/${projectId}/change-orders/${row.id}`}>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs">
                    {tCommon('view')}
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
