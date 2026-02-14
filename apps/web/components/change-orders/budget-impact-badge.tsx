'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function BudgetImpactBadge({ type }: { type: string }) {
  const t = useTranslations('changeOrders')
  const label = type === 'APPROVED_CHANGE' ? t('budgetImpactApproved') : t('budgetImpactDeviation')
  const className = type === 'APPROVED_CHANGE' ? 'badge-success' : 'badge-neutral'
  return (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}
