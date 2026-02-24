'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMessageBus } from '@/hooks/use-message-bus'
import { Link } from '@/i18n/navigation'
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
import { PlusIcon, Pencil, Trash2, Paperclip, FileDown, Loader2, History, TrendingUp } from 'lucide-react'
import { TransactionFormDialog } from './transaction-form-dialog'
import { TransactionStatusDropdown } from './transaction-status-dropdown'
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog'
import {
  deleteProjectTransaction,
  getProjectTransactions,
  getPartiesForProjectFilter,
  getTransactionAuditLogs,
  type GetProjectTransactionsFilters,
} from '@/app/actions/finance'
import { listDocumentsForEntity, getDocumentDownloadUrl } from '@/app/actions/documents'
import { FINANCE_TRANSACTION_ENTITY } from '@/lib/document-entities'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { exportProjectTransactionsToExcel } from '@/app/actions/export'
import { ExportDialog } from '@/components/export/export-dialog'
import { toast } from 'sonner'
import { STATUS_LABELS, getStatusLabel } from '@/lib/finance-labels'

function formatAuditLogDetail(log: {
  action: string
  beforeSnapshot?: Record<string, unknown> | null
  afterSnapshot?: Record<string, unknown> | null
  detailsJson?: { description?: string } | null
}): string {
  const desc = log.detailsJson?.description
  if (desc) return desc
  if (log.action === 'CREATE') return 'Transacción creada'
  if (log.action === 'DELETE') return 'Transacción anulada'
  if (log.action === 'UPDATE') {
    const before = log.beforeSnapshot as { status?: string } | undefined
    const after = log.afterSnapshot as { status?: string } | undefined
    if (before?.status !== undefined && after?.status !== undefined && before.status !== after.status) {
      return `Estado: ${getStatusLabel(before.status)} → ${getStatusLabel(after.status)}`
    }
    return 'Transacción actualizada'
  }
  return ''
}

function TransactionAttachmentsCell({ transactionId, count }: { transactionId: string; count: number }) {
  const [docs, setDocs] = useState<{ id: string; documentId: string; title: string; docType: string; versionId: string; fileName: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setDocs(null)
      return
    }
    setLoading(true)
    listDocumentsForEntity(FINANCE_TRANSACTION_ENTITY, transactionId)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [open, transactionId])

  async function handleDownload(versionId: string) {
    try {
      const { url } = await getDocumentDownloadUrl(versionId)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo descargar')
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" aria-label="Ver adjuntos">
          <Paperclip className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium">
              {count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : !docs || docs.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">Sin adjuntos</div>
        ) : (
          docs.map((d) => (
            <DropdownMenuItem key={d.id} onClick={() => handleDownload(d.versionId)}>
              <FileDown className="mr-2 h-4 w-4" />
              <span className="truncate">{d.title || d.fileName}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
  attachmentCount?: number
  deleted?: boolean
}

interface Props {
  projectId: string
  initialTransactions: ProjectTransactionRow[]
  projectBalance?: number
}

export function ProjectTransactionsListClient({
  projectId,
  initialTransactions,
  projectBalance,
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
  const [historyTxId, setHistoryTxId] = useState<string | null>(null)
  const [historyLogs, setHistoryLogs] = useState<{
    action: string
    createdAt: Date
    actor: { fullName: string | null; email: string | null }
    beforeSnapshot?: Record<string, unknown> | null
    afterSnapshot?: Record<string, unknown> | null
    detailsJson?: { description?: string } | null
  }[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useMessageBus('FINANCE_TRANSACTION.CREATED', () => router.refresh())
  useMessageBus('FINANCE_TRANSACTION.UPDATED', () => router.refresh())
  useMessageBus('PARTY.CREATED', () => {
    getPartiesForProjectFilter(projectId).then(setParties)
  })

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
      const result = await deleteProjectTransaction(id)
      if (result.success) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, deleted: true } : t))
        )
        toast.success('Transacción anulada')
      } else {
        toast.error(result.error ?? 'Error al anular')
      }
    } catch (error) {
      toast.error('Error al anular')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <>
      <div className="space-y-4">
        {projectBalance !== undefined && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Balance del proyecto:
              </span>
              <span
                className={`tabular-nums font-semibold ${
                  projectBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(projectBalance, 'ARS')}
              </span>
            </div>
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link href={`/projects/${projectId}/finance/cashflow`}>
                Ver Cashflow
              </Link>
            </Button>
          </div>
        )}
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
              <TableHead className="whitespace-nowrap" title="Referencia (ej. número de OC)">OC</TableHead>
              <TableHead className="text-right" title="En pesos argentinos">Monto ($)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="whitespace-nowrap">Creado por</TableHead>
              <TableHead className="w-28">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  No hay transacciones registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className={tx.deleted ? 'bg-muted/50 opacity-80' : undefined}
                >
                  <TableCell className={tx.deleted ? 'line-through text-muted-foreground' : undefined}>
                    {formatDateShort(tx.issueDate)}
                  </TableCell>
                  <TableCell className={`font-mono text-sm ${tx.deleted ? 'line-through text-muted-foreground' : ''}`}>
                    {tx.transactionNumber}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant={tx.type === 'EXPENSE' ? 'danger' : 'default'} className={tx.deleted ? 'opacity-70' : ''}>
                        {tx.type}
                      </Badge>
                      {tx.deleted && (
                        <Badge variant="neutral" className="text-muted-foreground">Anulada</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`max-w-[200px] truncate ${tx.deleted ? 'line-through text-muted-foreground' : ''}`}>
                    {tx.description}
                  </TableCell>
                  <TableCell className={tx.deleted ? 'line-through text-muted-foreground' : undefined}>
                    {tx.party?.name ?? '—'}
                  </TableCell>
                  <TableCell className={`font-mono text-xs ${tx.deleted ? 'line-through text-muted-foreground' : ''}`} title={tx.reference ?? undefined}>
                    {tx.reference?.trim() ? tx.reference.trim() : '—'}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${tx.deleted ? 'line-through text-muted-foreground' : ''}`}>
                    {formatCurrency(tx.amountBaseCurrency ?? toNum(tx), 'ARS')}
                  </TableCell>
                  <TableCell>
                    {tx.deleted ? (
                      <Badge variant="neutral" className="text-muted-foreground">{STATUS_LABELS[tx.status] ?? tx.status}</Badge>
                    ) : (
                      <TransactionStatusDropdown
                        transactionId={tx.id}
                        currentStatus={tx.status}
                        transactionType={tx.type}
                        onSuccess={(updated) => {
                          setTransactions((prev) =>
                            prev.map((t) => (t.id === tx.id ? { ...t, status: updated.status } : t))
                          )
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell className={`max-w-[180px] truncate text-xs text-muted-foreground ${tx.deleted ? 'line-through' : ''}`} title={`${tx.createdBy?.user?.fullName ?? '—'} — ${formatDateTime(tx.createdAt)}`}>
                    {tx.createdBy?.user?.fullName ?? '—'} · {formatDateTime(tx.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TransactionAttachmentsCell transactionId={tx.id} count={tx.attachmentCount ?? 0} />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const id = tx.id
                          setHistoryTxId(id)
                          setHistoryLogs([])
                          setHistoryLoading(true)
                          getTransactionAuditLogs(id)
                            .then((logs) => setHistoryLogs(logs))
                            .catch(() => setHistoryLogs([]))
                            .finally(() => setHistoryLoading(false))
                        }}
                        aria-label="Ver historial"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      {!tx.deleted && (
                        <>
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
                            aria-label="Anular"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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
        title="¿Anular transacción?"
        description="La transacción quedará anulada y visible en gris. Esta acción no se puede deshacer."
        confirmLabel="Anular"
        isLoading={isDeleting}
      />

      <Dialog open={!!historyTxId} onOpenChange={(open) => !open && setHistoryTxId(null)}>
        <DialogContent className="erp-form-modal max-w-2xl" aria-describedby="history-desc">
          <DialogHeader>
            <DialogTitle>Historial de la transacción</DialogTitle>
            <DialogDescription id="history-desc">
              Quién creó, cambió estado o anuló esta transacción.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando historial...
              </div>
            ) : historyLogs.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Sin registros de historial.</p>
            ) : (
              <ul className="space-y-2">
                {historyLogs.map((log, idx) => {
                  const detail = formatAuditLogDetail(log)
                  return (
                    <li
                      key={idx}
                      className="flex flex-col gap-1 rounded border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{log.action}</Badge>
                        <span className="text-muted-foreground">
                          {log.actor?.fullName ?? log.actor?.email ?? '—'}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      {detail && (
                        <p className="text-muted-foreground text-xs">{detail}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
