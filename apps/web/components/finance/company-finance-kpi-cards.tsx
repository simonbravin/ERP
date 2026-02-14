'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format-utils'
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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${variantClasses[card.variant]}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.value >= 0 ? variantClasses.success : variantClasses.destructive}`}>
              {formatCurrency(card.value, 'ARS')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
