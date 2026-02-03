'use client'

import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface BudgetTotalsFooterProps {
  directCostTotal: number
  materialsTotal: number
  laborTotal: number
  equipmentTotal: number
  overheadPct: number
  financialPct: number
  profitPct: number
  taxPct: number
}

export function BudgetTotalsFooter({
  directCostTotal,
  materialsTotal,
  laborTotal,
  equipmentTotal,
  overheadPct,
  financialPct,
  profitPct,
  taxPct,
}: BudgetTotalsFooterProps) {
  const t = useTranslations('budget')

  const overheadAmount = directCostTotal * (overheadPct / 100)
  const subtotal1 = directCostTotal + overheadAmount
  const financialAmount = subtotal1 * (financialPct / 100)
  const subtotal2 = subtotal1 + financialAmount
  const profitAmount = subtotal2 * (profitPct / 100)
  const subtotal3 = subtotal2 + profitAmount
  const taxAmount = subtotal3 * (taxPct / 100)
  const totalSale = subtotal3 + taxAmount

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('directCostBreakdown')}
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-400">💎 {t('materials')}</span>
                <span className="font-mono font-medium tabular-nums">{formatCurrency(materialsTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-700 dark:text-green-400">👷 {t('labor')}</span>
                <span className="font-mono font-medium tabular-nums">{formatCurrency(laborTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-orange-700 dark:text-orange-400">🚜 {t('equipment', { defaultValue: 'Equipos' })}</span>
                <span className="font-mono font-medium tabular-nums">{formatCurrency(equipmentTotal)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>{t('subtotalDirectCost', { defaultValue: 'Subtotal Costo Directo' })}</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(directCostTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('markupsAndTaxes', { defaultValue: 'Márgenes e Impuestos' })}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  + {t('overhead')} ({overheadPct}%)
                </span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(overheadAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-slate-700 dark:text-slate-300">{t('subtotal', { defaultValue: 'Subtotal' })} 1</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal1)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  + {t('financial', { defaultValue: 'GF' })} ({financialPct}%)
                </span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(financialAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-slate-700 dark:text-slate-300">{t('subtotal', { defaultValue: 'Subtotal' })} 2</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  + {t('profit', { defaultValue: 'Beneficio' })} ({profitPct}%)
                </span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(profitAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-slate-700 dark:text-slate-300">{t('subtotal', { defaultValue: 'Subtotal' })} 3</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal3)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  + {t('tax', { defaultValue: 'IVA' })} ({taxPct}%)
                </span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(taxAmount)}
                </span>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 dark:bg-blue-950/40">
                <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {t('totalSale', { defaultValue: 'TOTAL DE VENTA' })}
                </span>
                <span className="font-mono text-2xl font-bold tabular-nums text-blue-900 dark:text-blue-100">
                  {formatCurrency(totalSale)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
