'use client'

import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format-utils'
import { FolderKanban, DollarSign, FileCheck, TrendingDown } from 'lucide-react'
import type { KPIs } from '@/app/actions/dashboard'

interface KPICardsProps {
  kpis: KPIs
}

/**
 * KPI Cards for dashboard - shows key metrics
 */
export function KPICards({ kpis }: KPICardsProps) {
  const t = useTranslations('dashboard')

  const cards = [
    {
      title: t('kpiActiveProjects'),
      value: kpis.activeProjects,
      icon: FolderKanban,
      color: 'bg-blue-500',
      format: 'number' as const,
    },
    {
      title: t('kpiTotalBudget'),
      value: kpis.totalBudget,
      icon: DollarSign,
      color: 'bg-green-500',
      format: 'currency' as const,
    },
    {
      title: t('kpiPendingCertifications'),
      value: kpis.pendingCertifications,
      icon: FileCheck,
      color: 'bg-orange-500',
      format: 'number' as const,
    },
    {
      title: t('kpiMonthExpenses'),
      value: kpis.monthExpenses,
      icon: TrendingDown,
      color: 'bg-red-500',
      format: 'currency' as const,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="erp-card p-6 erp-transition-colors hover:shadow-[var(--shadow-card-hover)]">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {card.format === 'currency'
                  ? formatCurrency(card.value)
                  : card.value.toLocaleString('es-AR')}
              </p>
            </div>
            <div className={`${card.color} rounded-lg p-3`}>
              <card.icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
