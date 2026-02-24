'use client'

import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import type { ProjectOverheadItem } from '@/app/actions/finance'
import { PieChart } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  budgeted: number
  consumed: number
  initialItems: ProjectOverheadItem[]
}

export function ProjectOverheadClient({
  projectId,
  budgeted,
  consumed,
  initialItems,
}: Props) {
  const pct = budgeted > 0 ? Math.min((consumed / budgeted) * 100, 150) : 0
  const overBudget = budgeted > 0 && consumed > budgeted

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Generales del proyecto</h2>

      <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Generales presupuestados:</span>
          <span className="tabular-nums font-semibold text-foreground">
            {formatCurrency(budgeted, 'ARS')}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Consumido: {formatCurrency(consumed, 'ARS')}</span>
            {budgeted > 0 && (
              <span
                className={cn(
                  'tabular-nums font-medium',
                  overBudget ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                )}
              >
                {overBudget ? `${((consumed / budgeted) * 100).toFixed(0)}%` : `${pct.toFixed(0)}%`}
              </span>
            )}
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                overBudget
                  ? 'bg-red-500 dark:bg-red-600'
                  : pct >= 90
                    ? 'bg-amber-500 dark:bg-amber-600'
                    : pct >= 75
                      ? 'bg-amber-400 dark:bg-amber-500'
                      : 'bg-primary'
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 py-3 font-medium text-foreground">Número</TableHead>
              <TableHead className="px-4 py-3 font-medium text-foreground">Fecha</TableHead>
              <TableHead className="px-4 py-3 font-medium text-foreground">Descripción</TableHead>
              <TableHead className="px-4 py-3 font-medium text-foreground">Proveedor/Cliente</TableHead>
              <TableHead className="px-4 py-3 font-medium text-foreground">Origen</TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-foreground">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No hay generales asignados ni transacciones de generales del proyecto.
                </TableCell>
              </TableRow>
            ) : (
              initialItems.map((item) => (
                <TableRow key={`${item.source}-${item.id}`} className="border-b border-border/50 hover:bg-muted/30">
                  <TableCell className="px-4 py-2">
                    {item.transactionId ? (
                      <Link
                        href={`/finance/transactions/${item.transactionId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.transactionNumber}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{item.transactionNumber}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-muted-foreground">
                    {formatDateShort(item.issueDate)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate px-4 py-2 text-muted-foreground">
                    {item.description}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-muted-foreground">
                    {item.partyName ?? '—'}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-muted-foreground">
                    {item.source === 'allocation' ? 'Asignación empresa' : 'Proyecto'}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(item.amount, 'ARS')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {initialItems.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Total: {formatCurrency(consumed, 'ARS')} ({initialItems.length} ítem(s))
        </p>
      )}
    </div>
  )
}
