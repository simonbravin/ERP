'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMessageBus } from '@/hooks/use-message-bus'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { ListFiltersBar, SummaryCard } from '@/components/list'
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

function TransactionAttachmentsCell({ transactionId, count }: { transactionId: string; count: number }) {
  const t = useTranslations('finance')
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
      toast.error(t('downloadAttachmentError'))
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" aria-label={t('attachmentsAria')}>
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
            {t('attachmentsLoading')}
          </div>
        ) : !docs || docs.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">{t('attachmentsEmpty')}</div>
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
  total: number | null | { toNumber: () => number }
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
  const [, startTransition] = useTransition()

  type AppliedTxFilters = {
    filter: string
    dateFrom: string
    dateTo: string
    partyId: string
  }

  const [appliedFilters, setAppliedFilters] = useState<AppliedTxFilters | null>(null)
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

  const t = useTranslations('finance')
  const tCommon = useTranslations('common')

  function getStatusLabelI18n(status: string, txType?: string): string {
    if (status === 'PAID' && (txType === 'INCOME' || txType === 'SALE')) {
      return t('statusPaidCollected')
    }
    if (status === 'DRAFT') return t('statuses.DRAFT')
    if (status === 'SUBMITTED') return t('statuses.SUBMITTED')
    if (status === 'APPROVED') return t('statuses.APPROVED')
    if (status === 'PAID') return t('statuses.PAID')
    if (status === 'VOIDED') return t('statuses.VOIDED')
    return status
  }

  function formatProjectTxAuditDetail(
    log: {
      action: string
      beforeSnapshot?: Record<string, unknown> | null
      afterSnapshot?: Record<string, unknown> | null
      detailsJson?: { description?: string } | null
    },
    transactionType?: string
  ): string {
    const desc = log.detailsJson?.description
    if (desc) return desc
    if (log.action === 'CREATE') return t('auditLogCreated')
    if (log.action === 'DELETE') return t('auditLogDeleted')
    if (log.action === 'UPDATE') {
      const before = log.beforeSnapshot as { status?: string } | undefined
      const after = log.afterSnapshot as { status?: string } | undefined
      if (before?.status !== undefined && after?.status !== undefined && before.status !== after.status) {
        return t('auditLogStatusChange', {
          from: getStatusLabelI18n(before.status, transactionType),
          to: getStatusLabelI18n(after.status, transactionType),
        })
      }
      return t('auditLogUpdated')
    }
    return ''
  }

  const historyTx = historyTxId ? transactions.find((x) => x.id === historyTxId) : undefined

  useMessageBus('FINANCE_TRANSACTION.CREATED', () => router.refresh())
  useMessageBus('FINANCE_TRANSACTION.UPDATED', () => router.refresh())
  useMessageBus('PARTY.CREATED', () => {
    getPartiesForProjectFilter(projectId).then(setParties)
  })

  useEffect(() => {
    getPartiesForProjectFilter(projectId).then(setParties)
  }, [projectId])

  function buildApiFilters(a: AppliedTxFilters): GetProjectTransactionsFilters {
    const f: GetProjectTransactionsFilters = {}
    if (a.dateFrom) f.dateFrom = a.dateFrom
    if (a.dateTo) f.dateTo = a.dateTo
    if (a.partyId !== 'all') f.partyId = a.partyId
    if (a.filter !== 'all') f.type = a.filter
    return f
  }

  useEffect(() => {
    if (appliedFilters == null) {
      setTransactions(initialTransactions)
      return
    }
    const api = buildApiFilters(appliedFilters)
    if (Object.keys(api).length === 0) {
      setTransactions(initialTransactions)
      return
    }
    setIsLoadingFilters(true)
    getProjectTransactions(projectId, api)
      .then(setTransactions)
      .catch(() => toast.error(t('filterApplyError')))
      .finally(() => setIsLoadingFilters(false))
  }, [projectId, appliedFilters, initialTransactions, t])

  const filteredTransactions = transactions

  function toNum(row: ProjectTransactionRow): number {
    const raw = row.total
    if (raw == null) return 0
    if (typeof raw === 'number') return raw
    if (typeof raw === 'object' && 'toNumber' in raw) {
      return (raw as { toNumber: () => number }).toNumber()
    }
    return Number(raw)
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      const result = await deleteProjectTransaction(id)
      if (result.success === false) {
        toast.error(result.error)
        return
      }
      setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, deleted: true } : tx)))
      toast.success(t('transactionVoidedToast'))
    } catch {
      toast.error(t('voidTransactionError'))
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  function applyFilters() {
    startTransition(() => {
      const next: AppliedTxFilters = { filter, dateFrom, dateTo, partyId }
      const api = buildApiFilters(next)
      if (Object.keys(api).length === 0) {
        setAppliedFilters(null)
        return
      }
      setAppliedFilters(next)
    })
  }

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setPartyId('all')
    setFilter('all')
    setAppliedFilters(null)
  }

  return (
    <>
      <div className="space-y-4">
        {projectBalance !== undefined && (
          <SummaryCard
            icon={TrendingUp}
            label={`${t('projectBalance')}:`}
            value={
              <span
                className={
                  projectBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                {formatCurrency(projectBalance, 'ARS')}
              </span>
            }
            action={
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link href={`/projects/${projectId}/finance/cashflow`}>{t('viewCashflow')}</Link>
              </Button>
            }
          />
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ListFiltersBar
            onApply={applyFilters}
            onClear={clearFilters}
            isPending={isLoadingFilters}
          >
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('filterTypePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filterAllTypesShort')}</SelectItem>
                <SelectItem value="EXPENSE">{t('transactionTypes.EXPENSE')}</SelectItem>
                <SelectItem value="INCOME">{t('transactionTypes.INCOME')}</SelectItem>
                <SelectItem value="PURCHASE">{t('transactionTypes.PURCHASE')}</SelectItem>
                <SelectItem value="SALE">{t('transactionTypes.SALE')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="max-w-[140px]"
              aria-label={tCommon('from')}
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="max-w-[140px]"
              aria-label={tCommon('to')}
            />
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('partyFilterPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all')}</SelectItem>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (
                    {p.partyType === 'SUPPLIER' ? t('partyTypeSupplier') : t('partyTypeClient')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ListFiltersBar>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
              <FileDown className="mr-2 h-4 w-4" />
              {tCommon('export')}
            </Button>
            <Button onClick={() => setIsFormOpen(true)} disabled={isLoadingFilters}>
              <PlusIcon className="mr-2 h-4 w-4" />
              {t('newTransaction')}
            </Button>
          </div>
        </div>
      </div>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title={t('exportProjectTransactionsTitle')}
        columns={[
          { field: 'issueDate', label: t('date'), defaultVisible: true },
          { field: 'transactionNumber', label: t('transactionNumber'), defaultVisible: true },
          { field: 'type', label: t('type'), defaultVisible: true },
          { field: 'description', label: t('description'), defaultVisible: true },
          { field: 'partyName', label: t('partyColumn'), defaultVisible: true },
          { field: 'total', label: t('amount'), defaultVisible: true },
          { field: 'status', label: t('status'), defaultVisible: true },
        ]}
        onExport={async (format, selectedColumns) => {
          if (format !== 'excel') return { success: false, error: t('exportExcelOnlyError') }
          return exportProjectTransactionsToExcel(projectId, selectedColumns)
        }}
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('date')}</TableHead>
              <TableHead>{t('transactionNumber')}</TableHead>
              <TableHead>{t('type')}</TableHead>
              <TableHead>{t('description')}</TableHead>
              <TableHead>{t('partyColumn')}</TableHead>
              <TableHead className="whitespace-nowrap" title={t('ocColumnTooltip')}>
                {t('ocColumn')}
              </TableHead>
              <TableHead className="text-right" title={t('amountArsTooltip')}>
                {t('amountArsColumn')}
              </TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('createdBy')}</TableHead>
              <TableHead className="w-28">{tCommon('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  {t('noProjectTransactions')}
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
                        {(
                          {
                            EXPENSE: t('transactionTypes.EXPENSE'),
                            INCOME: t('transactionTypes.INCOME'),
                            PURCHASE: t('transactionTypes.PURCHASE'),
                            SALE: t('transactionTypes.SALE'),
                          } as Record<string, string>
                        )[tx.type] ?? tx.type}
                      </Badge>
                      {tx.deleted && (
                        <Badge variant="neutral" className="text-muted-foreground">{t('voided')}</Badge>
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
                      <Badge variant="neutral" className="text-muted-foreground">
                        {getStatusLabelI18n(tx.status, tx.type)}
                      </Badge>
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
                            .then((logs) =>
                              setHistoryLogs(
                                logs.map((l) => ({
                                  ...l,
                                  beforeSnapshot: l.beforeSnapshot as Record<string, unknown> | null | undefined,
                                  afterSnapshot: l.afterSnapshot as Record<string, unknown> | null | undefined,
                                  detailsJson:
                                    l.detailsJson &&
                                    typeof l.detailsJson === 'object' &&
                                    !Array.isArray(l.detailsJson)
                                      ? (l.detailsJson as { description?: string })
                                      : undefined,
                                }))
                              )
                            )
                            .catch(() => setHistoryLogs([]))
                            .finally(() => setHistoryLoading(false))
                        }}
                        aria-label={t('ariaViewHistory')}
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
                            aria-label={t('ariaEditTransaction')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(tx.id)}
                            aria-label={t('ariaVoidTransaction')}
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
        title={t('voidTransactionTitle')}
        description={t('voidTransactionDescription')}
        confirmLabel={t('voidTransactionConfirm')}
        isLoading={isDeleting}
      />

      <Dialog open={!!historyTxId} onOpenChange={(open) => !open && setHistoryTxId(null)}>
        <DialogContent className="erp-form-modal max-w-2xl" aria-describedby="history-desc">
          <DialogHeader>
            <DialogTitle>{t('txHistoryTitle')}</DialogTitle>
            <DialogDescription id="history-desc">{t('txHistoryDescription')}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('loadingHistory')}
              </div>
            ) : historyLogs.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">{t('noHistoryRecords')}</p>
            ) : (
              <ul className="space-y-2">
                {historyLogs.map((log, idx) => {
                  const detail = formatProjectTxAuditDetail(log, historyTx?.type)
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
