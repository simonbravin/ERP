'use client'

import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateShort, formatDateTime } from '@/lib/format-utils'
import { PlusIcon, Pencil, Trash2 } from 'lucide-react'
import { TransactionFormDialog } from './transaction-form-dialog'
import { TransactionStatusDropdown } from './transaction-status-dropdown'
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog'
import {
  deleteProjectTransaction,
  getProjectTransactions,
  getPartiesForProjectFilter,
  type GetProjectTransactionsFilters,
} from '@/app/actions/finance'
import { exportProjectTransactionsToExcel } from '@/app/actions/export'
import { ExportDialog } from '@/components/export/export-dialog'
import { toast } from 'sonner'
import { FileDown } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/finance-labels'

export type ProjectTransactionRow = {
  id: string
  transactionNumber: string
  type: string
  documentType?: string
  status: string
  issueDate: Date
  description: string
  dueDate?: Date | null
  subtotal?: number
  taxTotal?: number
  total: number
  amountBaseCurrency: number
  currency: string
  reference?: string | null
  retentionAmount?: number
  adjustmentAmount?: number
  adjustmentNotes?: string | null
  party: { id: string; name: string } | null
  lines: unknown[]
  payments: unknown[]
  createdBy: { user: { fullName: string } }
  createdAt: Date | string
}

interface Props {
  projectId: string
  initialTransactions: ProjectTransactionRow[]
}

export function ProjectTransactionsListClient({
  projectId,
  initialTransactions,
}: Props) {
  const router = useRouter()
  const [transactions, setTransactions] = useState(initialTransactions)
  const [filter, setFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [partyId, setPartyId] = useState<string>('all')
  const [parties, setParties] = useState<{ id: string; name: string; partyType: string }[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<ProjectTransactionRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoadingFilters, setIsLoadingFilters] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  useMessageBus('FINANCE_TRANSACTION.CREATED', () => router.refresh())
  useMessageBus('FINANCE_TRANSACTION.UPDATED', () => router.refresh())

  useEffect(() => {
    getPartiesForProjectFilter(projectId).then(setParties)
  }, [projectId])

  useEffect(() => {
    const filters: GetProjectTransactionsFilters = {}
    if (dateFrom) filters.dateFrom = dateFrom
    if (dateTo) filters.dateTo = dateTo
    if (partyId !== 'all') filters.partyId = partyId
    if (filter !== 'all') filters.type = filter
    const hasFilter = Object.keys(filters).length > 0
    if (!hasFilter) {
      setTransactions(initialTransactions)
      return
    }
    setIsLoadingFilters(true)
    getProjectTransactions(projectId, filters)
      .then(setTransactions)
      .catch(() => toast.error('Error al aplicar filtros'))
      .finally(() => setIsLoadingFilters(false))
  }, [projectId, dateFrom, dateTo, partyId, filter, initialTransactions])

  const filteredTransactions = transactions

  function toNum(t: ProjectTransactionRow): number {
    return typeof t.total === 'object' && t.total !== null && 'toNumber' in t.total
      ? (t.total as { toNumber: () => number }).toNumber()
      : Number(t.total)
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await deleteProjectTransaction(id)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      toast.success('Transacción eliminada')
    } catch (error) {
      toast.error('Error al eliminar')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="EXPENSE">Gastos</SelectItem>
                  <SelectItem value="INCOME">Ingresos</SelectItem>
                  <SelectItem value="PURCHASE">Compras</SelectItem>
                  <SelectItem value="SALE">Ventas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Proveedor/Cliente</Label>
              <Select value={partyId} onValueChange={setPartyId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.partyType === 'SUPPLIER' ? 'Proveedor' : 'Cliente'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button onClick={() => setIsFormOpen(true)} disabled={isLoadingFilters}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Nueva Transacción
            </Button>
          </div>
        </div>
      </div>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title="Exportar transacciones del proyecto"
        columns={[
          { field: 'issueDate', label: 'Fecha', defaultVisible: true },
          { field: 'transactionNumber', label: 'Número', defaultVisible: true },
          { field: 'type', label: 'Tipo', defaultVisible: true },
          { field: 'description', label: 'Descripción', defaultVisible: true },
          { field: 'partyName', label: 'Proveedor/Cliente', defaultVisible: true },
          { field: 'total', label: 'Monto', defaultVisible: true },
          { field: 'status', label: 'Estado', defaultVisible: true },
        ]}
        onExport={async (format, selectedColumns) => {
          if (format !== 'excel') return { success: false, error: 'Solo Excel disponible' }
          return exportProjectTransactionsToExcel(projectId, selectedColumns)
        }}
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Proveedor/Cliente</TableHead>
              <TableHead className="text-right" title="En pesos argentinos">Monto ($)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="whitespace-nowrap">Creado por</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No hay transacciones registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{formatDateShort(tx.issueDate)}</TableCell>
                  <TableCell className="font-mono text-sm">{tx.transactionNumber}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'EXPENSE' ? 'danger' : 'default'}>
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                  <TableCell>{tx.party?.name ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(tx.amountBaseCurrency ?? toNum(tx), 'ARS')}
                  </TableCell>
                  <TableCell>
                    <TransactionStatusDropdown
                      transactionId={tx.id}
                      currentStatus={tx.status}
                      onSuccess={(updated) => {
                        setTransactions((prev) =>
                          prev.map((t) => (t.id === tx.id ? { ...t, status: updated.status } : t))
                        )
                      }}
                    />
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground" title={`${tx.createdBy?.user?.fullName ?? '—'} — ${formatDateTime(tx.createdAt)}`}>
                    {tx.createdBy?.user?.fullName ?? '—'} · {formatDateTime(tx.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingTransaction(tx)
                          setIsFormOpen(true)
                        }}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(tx.id)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TransactionFormDialog
        projectId={projectId}
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) setEditingTransaction(null)
        }}
        transaction={editingTransaction}
        onSuccess={(newTx) => {
          if (editingTransaction) {
            setTransactions((prev) =>
              prev.map((t) => (t.id === newTx.id ? { ...t, ...newTx } : t))
            )
          } else {
            setTransactions((prev) => [newTx as ProjectTransactionRow, ...prev])
          }
          setIsFormOpen(false)
          setEditingTransaction(null)
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await handleDelete(deleteId) }}
        title="¿Eliminar transacción?"
        description="Esta acción no se puede deshacer."
        isLoading={isDeleting}
      />
    </>
  )
}
