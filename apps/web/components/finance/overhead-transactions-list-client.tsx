'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMessageBus } from '@/hooks/use-message-bus'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/format-utils'
import { Split, Eye, Trash2 } from 'lucide-react'
import { OverheadAllocationDialog } from '@/components/finance/overhead-allocation-dialog'
import { AllocationDetailsDialog } from '@/components/finance/allocation-details-dialog'
import { deleteOverheadAllocation, getOverheadTransactions } from '@/app/actions/finance'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ExportDialog } from '@/components/export/export-dialog'
import { exportOverheadToExcel } from '@/app/actions/export'
import type { OverheadTransactionWithAllocations } from '@/app/actions/finance'
import { FileDown } from 'lucide-react'

type ProjectOption = { id: string; name: string; projectNumber: string }

interface Props {
  initialTransactions: OverheadTransactionWithAllocations[]
  projects: ProjectOption[]
}

export function OverheadTransactionsListClient({
  initialTransactions,
  projects,
}: Props) {
  const router = useRouter()
  const [transactions, setTransactions] = useState(initialTransactions)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'OVERHEAD' | 'EXPENSE'>('all')
  const [search, setSearch] = useState<string>('')
  const [selectedTransaction, setSelectedTransaction] =
    useState<OverheadTransactionWithAllocations | null>(null)
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [deleteAllocationId, setDeleteAllocationId] = useState<string | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)

  useMessageBus('FINANCE_TRANSACTION.CREATED', () => {
    router.refresh()
    getOverheadTransactions().then(setTransactions)
  })
  useMessageBus('FINANCE_TRANSACTION.UPDATED', () => {
    router.refresh()
    getOverheadTransactions().then(setTransactions)
  })
  useMessageBus('OVERHEAD_ALLOCATION.UPDATED', () => {
    router.refresh()
    getOverheadTransactions().then(setTransactions)
  })
  useMessageBus('OVERHEAD_ALLOCATION.DELETED', () => {
    router.refresh()
    getOverheadTransactions().then(setTransactions)
  })

  const filteredByStatus =
    filterStatus === 'all'
      ? transactions
      : transactions.filter((t) => t.status === filterStatus)

  const filteredTransactions = filteredByStatus.filter((tx) => {
    if (dateFrom) {
      const d = tx.issueDate instanceof Date ? tx.issueDate : new Date(tx.issueDate)
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      if (d < from) return false
    }
    if (dateTo) {
      const d = tx.issueDate instanceof Date ? tx.issueDate : new Date(tx.issueDate)
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      if (d > to) return false
    }
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false
    const q = search.trim().toLowerCase()
    if (q) {
      const num = (tx.transactionNumber ?? '').toLowerCase()
      const desc = (tx.description ?? '').toLowerCase()
      if (!num.includes(q) && !desc.includes(q)) return false
    }
    return true
  })

  const handleDeleteAllocation = async (allocationId: string) => {
    try {
      await deleteOverheadAllocation(allocationId)
      const updated = await getOverheadTransactions()
      setTransactions(updated)
      if (selectedTransaction) {
        const tx = updated.find((t) => t.id === selectedTransaction.id)
        if (tx) setSelectedTransaction(tx)
      }
      toast.success('Asignación eliminada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar')
    } finally {
      setDeleteAllocationId(null)
    }
  }

  const handleAllocationSuccess = async () => {
    try {
      const updated = await getOverheadTransactions()
      setTransactions(updated)
      router.refresh()
    } catch {
      toast.error('Error al actualizar la lista')
    }
  }

  async function handleExport(format: 'excel' | 'pdf', selectedColumns: string[]) {
    if (format === 'pdf') return { success: false, error: 'Exportación PDF no disponible para overhead' }
    return exportOverheadToExcel(selectedColumns)
  }

  const exportColumns = [
    { field: 'issueDate', label: 'Fecha', defaultVisible: true },
    { field: 'transactionNumber', label: 'Número', defaultVisible: true },
    { field: 'description', label: 'Descripción', defaultVisible: true },
    { field: 'total', label: 'Total', defaultVisible: true },
    { field: 'totalAllocatedPct', label: '% Asignado', defaultVisible: true },
    { field: 'remainingAmount', label: 'Pendiente', defaultVisible: true },
    { field: 'status', label: 'Estado', defaultVisible: true },
  ]

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'danger' | 'default' | 'success'; label: string }> = {
      unallocated: { variant: 'danger', label: 'Sin Asignar' },
      partial: { variant: 'default', label: 'Parcial' },
      complete: { variant: 'success', label: 'Completo' },
    }
    const c = config[status] ?? { variant: 'default', label: status }
    return <Badge variant={c.variant}>{c.label}</Badge>
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Transacciones Overhead</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
              title="Exportar a Excel"
            >
              <FileDown className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unallocated">Sin Asignar</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="complete">Completo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <span className="text-sm font-medium text-foreground">Filtros</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="Desde"
              className="max-w-[140px]"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Hasta"
              className="max-w-[140px]"
            />
            <Select value={typeFilter} onValueChange={(v: 'all' | 'OVERHEAD' | 'EXPENSE') => setTypeFilter(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="OVERHEAD">Overhead</SelectItem>
                <SelectItem value="EXPENSE">Gasto</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar por número o descripción"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-[220px]"
            />
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Asignado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No hay transacciones overhead que coincidan con el filtro
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(tx.issueDate)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{tx.transactionNumber}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={tx.description}>
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.party?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(tx.total, tx.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(tx.totalAllocatedAmount, tx.currency)}
                        <span className="ml-1 text-xs">
                          ({tx.totalAllocatedPct.toFixed(1)}%)
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(tx.remainingAmount, tx.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {tx.allocations.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedTransaction(tx)
                                setIsDetailsDialogOpen(true)
                              }}
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {tx.status !== 'complete' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedTransaction(tx)
                                setIsAllocationDialogOpen(true)
                              }}
                              title="Asignar a proyectos"
                            >
                              <Split className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedTransaction && (
        <OverheadAllocationDialog
          open={isAllocationDialogOpen}
          onOpenChange={setIsAllocationDialogOpen}
          transaction={{
            id: selectedTransaction.id,
            description: selectedTransaction.description,
            total: selectedTransaction.total,
            currency: selectedTransaction.currency,
            totalAllocatedPct: selectedTransaction.totalAllocatedPct,
            remainingAmount: selectedTransaction.remainingAmount,
            allocations: selectedTransaction.allocations.map((a) => ({
              projectId: a.projectId,
              allocationPct: a.allocationPct,
              allocationAmount: a.allocationAmount,
            })),
          }}
          projects={projects}
          onSuccess={handleAllocationSuccess}
        />
      )}

      {selectedTransaction && (
        <AllocationDetailsDialog
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
          transaction={{
            description: selectedTransaction.description,
            total: selectedTransaction.total,
            allocations: selectedTransaction.allocations,
          }}
          onDelete={(allocationId) => setDeleteAllocationId(allocationId)}
        />
      )}

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title="Exportar transacciones overhead (Excel)"
        columns={exportColumns}
        onExport={handleExport}
      />

      <AlertDialog open={!!deleteAllocationId} onOpenChange={() => setDeleteAllocationId(null)}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllocationId && handleDeleteAllocation(deleteAllocationId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
