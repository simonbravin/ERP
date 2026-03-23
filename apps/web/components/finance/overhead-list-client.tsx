'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/format-utils'
import { allocateOverhead } from '@/app/actions/finance'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export type OverheadTransactionRow = {
  id: string
  transactionNumber: string
  description: string
  total: number
  amountBaseCurrency?: number
  overheadAllocations: Array<{
    allocationAmount: number
    project?: { name: string }
  }>
}

type ProjectOption = { id: string; name: string; projectNumber: string }

interface Props {
  initialTransactions: OverheadTransactionRow[]
  projects: ProjectOption[]
}

export function OverheadListClient({ initialTransactions, projects }: Props) {
  const tFin = useTranslations('finance')
  const [transactions, setTransactions] = useState<OverheadTransactionRow[]>(initialTransactions)
  const [isPending, startTransition] = useTransition()
  const [allocatingTxId, setAllocatingTxId] = useState<string | null>(null)
  const [allocationPcts, setAllocationPcts] = useState<Record<string, number>>({})

  function getAllocatedAmount(tx: OverheadTransactionRow): number {
    return tx.overheadAllocations.reduce(
      (sum, a) => sum + (typeof a.allocationAmount === 'number' ? a.allocationAmount : Number(a.allocationAmount)),
      0
    )
  }

  function getUnallocatedAmount(tx: OverheadTransactionRow): number {
    const total = tx.amountBaseCurrency ?? tx.total
    return Math.max(0, total - getAllocatedAmount(tx))
  }

  function openAllocationDialog(tx: OverheadTransactionRow) {
    setAllocatingTxId(tx.id)
    const current: Record<string, number> = {}
    projects.forEach((p) => {
      current[p.id] = 0
    })
    tx.overheadAllocations.forEach((a: { projectId?: string; allocationPct?: number; allocationAmount: number; project?: { name: string } }) => {
      const projectId = a.projectId
      if (projectId != null) {
        const pct = typeof a.allocationPct === 'number' ? a.allocationPct : Number(a.allocationPct)
        current[projectId] = pct
      }
    })
    setAllocationPcts(current)
  }

  function closeAllocationDialog() {
    setAllocatingTxId(null)
    setAllocationPcts({})
  }

  function setPct(projectId: string, value: number) {
    setAllocationPcts((prev) => ({ ...prev, [projectId]: value }))
  }

  const totalPct = Object.values(allocationPcts).reduce((s, v) => s + v, 0)
  const isValidPct = Math.abs(totalPct - 100) < 0.01

  function submitAllocation() {
    if (!allocatingTxId) return
    if (!isValidPct) {
      toast.error(tFin('toast.overheadPercentMust100'))
      return
    }
    const allocations = Object.entries(allocationPcts)
      .filter(([, pct]) => pct > 0)
      .map(([projectId, allocationPct]) => ({ projectId, allocationPct }))
    if (allocations.length === 0) {
      toast.error(tFin('toast.overheadAtLeastOneProject'))
      return
    }
    startTransition(async () => {
      try {
        await allocateOverhead(allocatingTxId, allocations)
        toast.success(tFin('toast.overheadAssignedSuccess'))
        closeAllocationDialog()
        const tx = transactions.find((t) => t.id === allocatingTxId)
        const totalAmount = tx?.amountBaseCurrency ?? tx?.total ?? 0
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === allocatingTxId
              ? {
                  ...t,
                  overheadAllocations: allocations.map((a) => ({
                    projectId: a.projectId,
                    allocationPct: a.allocationPct,
                    allocationAmount: (totalAmount * a.allocationPct) / 100,
                    project: { name: projects.find((p) => p.id === a.projectId)?.name ?? '' },
                  })),
                }
              : t
          )
        )
        window.dispatchEvent(new Event('overhead-allocated'))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al asignar')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Número</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Descripción</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Total</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Asignado</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Sin asignar</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No hay transacciones de overhead.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const allocated = getAllocatedAmount(tx)
                const unallocated = getUnallocatedAmount(tx)
                return (
                  <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 font-mono text-foreground">{tx.transactionNumber}</td>
                    <td className="max-w-[300px] truncate px-4 py-2 text-foreground" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {formatCurrency(tx.amountBaseCurrency ?? tx.total, 'ARS')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(allocated, 'ARS')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {unallocated > 0 ? (
                        <Badge variant="secondary">{formatCurrency(unallocated, 'ARS')}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openAllocationDialog(tx)}
                      >
                        Asignar
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!allocatingTxId} onOpenChange={(open) => !open && closeAllocationDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Asignar overhead a proyectos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            La suma de los porcentajes debe ser 100%. El monto se repartirá entre los proyectos indicados.
          </p>
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <Label className="min-w-[120px] text-sm">
                  {p.projectNumber} – {p.name}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={allocationPcts[p.id] ?? 0}
                  onChange={(e) => setPct(p.id, Number(e.target.value) || 0)}
                  className="w-24 text-right"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            ))}
          </div>
          <div className="text-sm font-medium">
            Total: {totalPct.toFixed(1)}% {!isValidPct && <span className="text-destructive">(debe ser 100%)</span>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAllocationDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitAllocation} disabled={!isValidPct || isPending}>
              {isPending ? 'Guardando...' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
