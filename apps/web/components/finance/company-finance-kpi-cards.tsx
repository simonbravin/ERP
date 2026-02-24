'use client'

import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyForDisplay } from '@/lib/format-utils'
import { TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

interface CompanyFinanceKPICardsProps {
  data: {
    totalIncome: number
    totalExpense: number
    balance: number
    pendingIncome: number
    pendingExpense: number
    currentMonthIncome: number
    currentMonthExpense: number
    currentMonthNet: number
    unallocatedOverhead: number
  }
}

const CARD_WRAPPER =
  'rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md min-w-0'

export function CompanyFinanceKPICards({ data }: CompanyFinanceKPICardsProps) {
  const cards = [
    {
      title: 'Balance total',
      value: data.balance,
      icon: TrendingUp,
      variant: data.balance >= 0 ? 'success' : 'destructive',
      description: `Ingresos: ${formatCurrency(data.totalIncome, 'ARS')} | Gastos: ${formatCurrency(data.totalExpense, 'ARS')}`,
    },
    {
      title: 'Flujo del mes',
      value: data.currentMonthNet,
      icon: data.currentMonthNet >= 0 ? ArrowUpCircle : ArrowDownCircle,
      variant: data.currentMonthNet >= 0 ? 'success' : 'destructive',
      description: `${formatCurrency(data.currentMonthIncome, 'ARS')} − ${formatCurrency(data.currentMonthExpense, 'ARS')}`,
    },
    {
      title: 'Por cobrar',
      value: data.pendingIncome,
      icon: ArrowUpCircle,
      variant: 'default',
      description: 'Pendiente de cobro',
    },
    {
      title: 'Por pagar',
      value: data.pendingExpense,
      icon: ArrowDownCircle,
      variant: 'warning',
      description: 'Pendiente de pago',
    },
  ]

  const variantClasses = {
    success: 'text-green-600 dark:text-green-500',
    destructive: 'text-red-600 dark:text-red-500',
    warning: 'text-amber-600 dark:text-amber-500',
    default: 'text-slate-600 dark:text-slate-400',
  }

  const iconBgClasses = {
    success: 'text-green-600 bg-green-100 dark:bg-green-950/50 dark:text-green-400',
    destructive: 'text-red-600 bg-red-100 dark:bg-red-950/50 dark:text-red-400',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-950/50 dark:text-amber-400',
    default: 'text-slate-600 bg-slate-100 dark:bg-slate-950/50 dark:text-slate-400',
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className={CARD_WRAPPER}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <p
                className={cn(
                  'mt-1.5 min-w-0 font-semibold tabular-nums text-foreground',
                  'text-xl lg:text-lg',
                  card.value >= 0 ? variantClasses.success : variantClasses.destructive
                )}
              >
                {formatCurrencyForDisplay(card.value, 'ARS')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
            </div>
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                iconBgClasses[card.variant]
              )}
            >
              <card.icon className="h-5 w-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
