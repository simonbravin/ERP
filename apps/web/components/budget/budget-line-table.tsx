'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyForDisplay } from '@/lib/format-utils'
import { calculateBudgetLine } from '@/lib/budget-calculations'
import { useTranslations } from 'next-intl'

export type BudgetLineRow = {
  id: string
  description: string
  unit: string
  quantity: number
  directCostTotal: number
  salePriceTotal?: number
  overheadPct?: number
  financialPct?: number
  profitPct?: number
  taxPct?: number
  wbsNode: { id: string; code: string; name: string }
}

type BudgetLineTableProps = {
  lines: BudgetLineRow[]
  versionTotal: number
  canEdit: boolean
  canViewAdmin?: boolean
  onDelete: (lineId: string) => Promise<void>
}

function toNum(v: number | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : 0
}

function calculateLineBreakdown(line: BudgetLineRow) {
  const qty = toNum(line.quantity)
  const directTotal = toNum(line.directCostTotal)
  const unitDirect = qty > 0 ? directTotal / qty : 0
  const oh = toNum(line.overheadPct) || 0
  const fin = toNum(line.financialPct) || 0
  const prof = toNum(line.profitPct) || 0
  const tax = toNum(line.taxPct) ?? 21
  const calc = calculateBudgetLine(unitDirect, oh, fin, prof, tax)
  return {
    directCost: Number(calc.directCost) * qty,
    overheadAmount: Number(calc.overheadAmount) * qty,
    subtotal1: Number(calc.subtotal1) * qty,
    financialAmount: Number(calc.financialAmount) * qty,
    profitAmount: Number(calc.profitAmount) * qty,
    subtotal2: Number(calc.subtotal2) * qty,
    taxAmount: Number(calc.taxAmount) * qty,
    totalPrice: Number(calc.totalPrice) * qty,
  }
}

export function BudgetLineTable({
  lines,
  versionTotal,
  canEdit,
  canViewAdmin = false,
  onDelete,
}: BudgetLineTableProps) {
  const t = useTranslations('budget')
  const [viewMode, setViewMode] = useState<'admin' | 'client'>('client')
  const showAdmin = canViewAdmin && viewMode === 'admin'

  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
        {t('noBudgetLinesYet')}
      </div>
    )
  }

  const byWbs = new Map<string, BudgetLineRow[]>()
  for (const line of lines) {
    const key = line.wbsNode.id
    if (!byWbs.has(key)) byWbs.set(key, [])
    byWbs.get(key)!.push(line)
  }

  const wbsOrder = Array.from(byWbs.keys()).sort((a, b) => {
    const lineA = byWbs.get(a)![0]
    const lineB = byWbs.get(b)![0]
    return lineA.wbsNode.code.localeCompare(lineB.wbsNode.code)
  })

  const grandTotal = lines.reduce((sum, line) => {
    const b = calculateLineBreakdown(line)
    return sum + b.totalPrice
  }, 0)

  return (
    <div className="space-y-4">
      {canViewAdmin && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t('viewModeTitle', { defaultValue: 'Modo de Visualización' })}:</span>
          <Button
            variant={viewMode === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('admin')}
          >
            {t('viewModeAdmin', { defaultValue: 'Modo Administrador' })}
          </Button>
          <Button
            variant={viewMode === 'client' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('client')}
          >
            {t('viewModeClient', { defaultValue: 'Modo Cliente' })}
          </Button>
        </div>
      )}
      {viewMode === 'client' && (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
          <strong>{t('clientViewNotice', { defaultValue: 'Vista para Cliente' })}</strong>
          <p className="mt-1 text-muted-foreground">
            {t('clientViewNoticeDesc', { defaultValue: 'Esta vista oculta los costos internos y márgenes. Solo muestra precios de venta.' })}
          </p>
        </div>
      )}
      <div className="rounded-lg border border-border overflow-x-auto bg-card">
      <table className="erp-table-surface w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('wbs')}</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('description')}</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('quantity')}</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('unit')}</th>
            {showAdmin ? (
              <>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('directCost', { defaultValue: 'Costo Directo' })}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('overhead', { defaultValue: 'GG' })}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('subtotal1', { defaultValue: 'Subtotal 1' })}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('financial', { defaultValue: 'GF' })}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('profit', { defaultValue: 'Benef.' })}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('subtotal2', { defaultValue: 'Subtotal 2' })}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('tax', { defaultValue: 'IVA' })}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('total')}</th>
              </>
            ) : (
              <>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('unitPrice', { defaultValue: 'P. Unitario' })}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('total')}</th>
              </>
            )}
            {canEdit && <th className="w-20 px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {wbsOrder.map((wbsId) => {
            const group = byWbs.get(wbsId)!
            const first = group[0]
            return (
              <tbody key={wbsId}>
                {group.map((line, idx) => (
                  <tr
                    key={line.id}
                    className={cn(
                      'border-b border-border hover:bg-muted/50',
                      idx === 0 && 'bg-muted/30'
                    )}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">
                      {idx === 0 ? first.wbsNode.code : ''}
                    </td>
                    <td className="px-3 py-2 text-foreground">{line.description}</td>
                    <td className="text-right tabular-nums text-foreground">
                      {line.quantity}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{line.unit}</td>
                    {showAdmin ? (
                      (() => {
                        const b = calculateLineBreakdown(line)
                        return (
                          <>
                            <td className="erp-table-cell-currency text-gray-700 dark:text-gray-300">{formatCurrencyForDisplay(b.directCost)}</td>
                            <td className="erp-table-cell-currency text-gray-700 dark:text-gray-300">{formatCurrencyForDisplay(b.overheadAmount)}</td>
                            <td className="erp-table-cell-currency text-gray-700 dark:text-gray-300">{formatCurrencyForDisplay(b.subtotal1)}</td>
                            <td className="erp-table-cell-currency text-gray-700 dark:text-gray-300">{formatCurrencyForDisplay(b.financialAmount)}</td>
                            <td className="erp-table-cell-currency text-gray-700 dark:text-gray-300">{formatCurrencyForDisplay(b.profitAmount)}</td>
                            <td className="erp-table-cell-currency text-gray-700 dark:text-gray-300">{formatCurrencyForDisplay(b.subtotal2)}</td>
                            <td className="erp-table-cell-currency text-gray-700 dark:text-gray-300">{formatCurrencyForDisplay(b.taxAmount)}</td>
                            <td className="erp-table-cell-currency font-medium text-gray-900 dark:text-white">{formatCurrencyForDisplay(b.totalPrice)}</td>
                          </>
                        )
                      })()
                    ) : (
                      (() => {
                        const b = calculateLineBreakdown(line)
                        const unitPrice = toNum(line.quantity) > 0 ? b.totalPrice / toNum(line.quantity) : 0
                        return (
                          <>
                            <td className="text-right tabular-nums text-foreground">{formatCurrency(unitPrice)}</td>
                            <td className="text-right tabular-nums font-medium text-foreground">{formatCurrency(b.totalPrice)}</td>
                          </>
                        )
                      })()
                    )}
                    {canEdit && (
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-destructive hover:opacity-90"
                          onClick={() => onDelete(line.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted font-bold">
            <td colSpan={showAdmin ? 12 : 5} className="px-3 py-2 text-right">
              {t('grandTotal', { defaultValue: 'TOTAL GENERAL' })}:
            </td>
            <td className="erp-table-cell-currency px-3 py-2 text-right text-lg text-foreground">
              {formatCurrencyForDisplay(grandTotal)}
            </td>
            {canEdit && <td />}
          </tr>
        </tfoot>
      </table>
      </div>
      <div className="border-t border-border bg-muted px-3 py-2 text-right font-medium tabular-nums text-foreground erp-kpi-value">
        {t('versionTotal')}: {formatCurrencyForDisplay(versionTotal)}
      </div>
    </div>
  )
}
