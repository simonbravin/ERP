'use client'

import { useTranslations } from 'next-intl'
import { formatCurrencyForDisplay } from '@/lib/format-utils'
import { Link } from '@/i18n/navigation'
import {
  FolderKanban,
  DollarSign,
  FileCheck,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  Percent,
  ClipboardList,
} from 'lucide-react'
import type { KPIs } from '@/app/actions/dashboard'

type KPIVariant = 'main' | 'finance' | 'all'

interface KPICardsProps {
  kpis: KPIs
  /** main = 4 cards (proyectos, presupuesto, gastos, avance); finance = 4 (certs, AR, AP, órdenes de cambio) */
  variant?: KPIVariant
}

const CARD_STYLES = {
  main: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  finance: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  all: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8',
} as const

/**
 * KPI Cards for dashboard. main = 4 (proyectos link, presupuesto, gastos, avance); finance = 4 (certificaciones, AR, AP, órdenes de cambio).
 */
export function KPICards({ kpis, variant = 'all' }: KPICardsProps) {
  const t = useTranslations('dashboard')

  const allCards = [
    {
      id: 'activeProjects',
      title: t('kpiActiveProjects'),
      value: kpis.activeProjects,
      icon: FolderKanban,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400',
      format: 'number' as const,
      href: '/projects' as string | undefined,
    },
    {
      id: 'totalBudget',
      title: t('kpiTotalBudget'),
      value: kpis.totalBudget,
      icon: DollarSign,
      color: 'text-green-600 bg-green-100 dark:bg-green-950/50 dark:text-green-400',
      format: 'currency' as const,
      href: undefined,
    },
    {
      id: 'pendingCertifications',
      title: t('kpiPendingCertifications'),
      value: kpis.pendingCertifications,
      icon: FileCheck,
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-950/50 dark:text-orange-400',
      format: 'number' as const,
      href: undefined,
    },
    {
      id: 'monthExpenses',
      title: t('kpiMonthExpenses'),
      value: kpis.monthExpenses,
      icon: TrendingDown,
      color: 'text-red-600 bg-red-100 dark:bg-red-950/50 dark:text-red-400',
      format: 'currency' as const,
      href: undefined,
    },
    {
      id: 'accountsReceivable',
      title: t('kpiAccountsReceivable'),
      value: kpis.accountsReceivable,
      icon: ArrowDownCircle,
      color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400',
      format: 'currency' as const,
      href: undefined,
    },
    {
      id: 'accountsPayable',
      title: t('kpiAccountsPayable'),
      value: kpis.accountsPayable,
      icon: ArrowUpCircle,
      color: 'text-amber-600 bg-amber-100 dark:bg-amber-950/50 dark:text-amber-400',
      format: 'currency' as const,
      href: undefined,
    },
    {
      id: 'progressPct',
      title: t('kpiProgressMargin'),
      value: kpis.progressPct,
      icon: Percent,
      color: 'text-violet-600 bg-violet-100 dark:bg-violet-950/50 dark:text-violet-400',
      format: 'percent' as const,
      href: undefined,
    },
    {
      id: 'pendingChangeOrders',
      title: t('kpiChangeOrders'),
      value: kpis.pendingChangeOrders,
      icon: ClipboardList,
      color: 'text-slate-600 bg-slate-100 dark:bg-slate-950/50 dark:text-slate-400',
      format: 'number' as const,
      href: undefined,
    },
  ]

  const cards =
    variant === 'main'
      ? allCards.filter((c) =>
          ['activeProjects', 'totalBudget', 'monthExpenses', 'progressPct'].includes(c.id)
        )
      : variant === 'finance'
        ? allCards.filter((c) =>
            ['pendingCertifications', 'accountsReceivable', 'accountsPayable', 'pendingChangeOrders'].includes(c.id)
          )
        : allCards

  const cardContent = (card: (typeof cards)[0]) => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
          {card.format === 'currency'
            ? formatCurrencyForDisplay(card.value)
            : card.format === 'percent'
              ? card.value != null
                ? `${Number(card.value).toFixed(1)}%`
                : '—'
              : Number(card.value).toLocaleString('es-AR')}
        </p>
      </div>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${card.color}`}>
        <card.icon className="h-5 w-5" />
      </div>
    </div>
  )

  return (
    <div className={`grid gap-4 ${CARD_STYLES[variant]}`}>
      {cards.map((card) => {
        const wrapperClass =
          'rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md min-w-0'
        if (card.href) {
          return (
            <Link key={card.id} href={card.href} className={`block ${wrapperClass}`}>
              {cardContent(card)}
            </Link>
          )
        }
        return (
          <div key={card.id} className={wrapperClass}>
            {cardContent(card)}
          </div>
        )
      })}
    </div>
  )
}
