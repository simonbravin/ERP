'use client'

import { formatCurrencyForDisplay } from '@/lib/format-utils'
import { Package, AlertTriangle, DollarSign, Activity } from 'lucide-react'

const CARD_CLASS =
  'rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md min-w-0'

interface InventoryKPICardsProps {
  totalItems: number
  criticalStock: number
  totalValue: number
  monthMovements: number
}

export function InventoryKPICards({
  totalItems,
  criticalStock,
  totalValue,
  monthMovements,
}: InventoryKPICardsProps) {
  const cards = [
    {
      title: 'Items activos',
      value: totalItems,
      icon: Package,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400',
    },
    {
      title: 'Stock crítico',
      value: criticalStock,
      icon: AlertTriangle,
      color:
        criticalStock > 0
          ? 'text-amber-600 bg-amber-100 dark:bg-amber-950/50 dark:text-amber-400'
          : 'text-slate-600 bg-slate-100 dark:bg-slate-950/50 dark:text-slate-400',
    },
    {
      title: 'Valor inventario',
      value: formatCurrencyForDisplay(totalValue),
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
    {
      title: 'Movimientos (mes)',
      value: monthMovements,
      icon: Activity,
      color: 'text-slate-600 bg-slate-100 dark:bg-slate-950/50 dark:text-slate-400',
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className={CARD_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">{card.value}</p>
            </div>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
