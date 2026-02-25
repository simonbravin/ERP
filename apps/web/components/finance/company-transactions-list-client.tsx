'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useMessageBus } from '@/hooks/use-message-bus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import { getCompanyTransactions } from '@/app/actions/finance'
import {
  exportCompanyTransactionsToExcel,
  type CompanyTransactionsExportFilters,
} from '@/app/actions/export'
import { ExportDialog } from '@/components/export/export-dialog'
import { TransactionFormDialog } from './transaction-form-dialog'
import { DOCUMENT_TYPE_LABELS, TYPE_LABELS, getStatusLabel } from '@/lib/finance-labels'
import { FileDown, TrendingUp } from 'lucide-react'

export type CompanyTransactionRow = {
  id: string
  transactionNumber: string
  issueDate: Date | string
  type: string
  documentType?: string
  status: string
  description: string
  total: number
  amountBaseCurrency: number
  currency: string
  project: { id: string; name: string; projectNumber: string } | null
  party: { id: string; name: string; partyType: string } | null
  createdBy?: { user: { fullName: string } }
}

type FilterOptions = {
  projects: Array<{ id: string; name: string; projectNumber: string }>
  parties: Array<{ id: string; name: string; partyType: string }>
}

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'outline' | 'danger'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  APPROVED: 'outline',
  PAID: 'default',
  VOIDED: 'danger',
}

interface Props {
  initialTransactions: CompanyTransactionRow[]
  filterOptions: FilterOptions
  canCreate: boolean
  /** Balance de la empresa (ingresos − gastos pagados). Se muestra arriba como en Balance del proyecto. */
  companyBalance?: number
}

export function CompanyTransactionsListClient({
  initialTransactions,
  filterOptions,
  canCreate,
  companyBalance,
}: Props) {
  const router = useRouter()
  const t = useTranslations('finance')
  const tCommon = useTranslations('common')
  const [transactions, setTransactions] = useState<CompanyTransactionRow[]>(initialTransactions)
  const [isPending, startTransition] = useTransition()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  useMessageBus('FINANCE_TRANSACTION.CREATED', () => router.refresh())
  useMessageBus('FINANCE_TRANSACTION.UPDATED', () => router.refresh())

  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [partyFilter, setPartyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  type FilterOverrides = Partial<{
    projectFilter: string
    typeFilter: string
    partyFilter: string
    statusFilter: string
    dateFrom: string
    dateTo: string
    searchTerm: string
  }>

  function applyFilters(overrides: FilterOverrides = {}) {
    const p = overrides.projectFilter ?? projectFilter
    const ty = overrides.typeFilter ?? typeFilter
    const pa = overrides.partyFilter ?? partyFilter
    const st = overrides.statusFilter ?? statusFilter
    const df = overrides.dateFrom ?? dateFrom
    const dt = overrides.dateTo ?? dateTo
    const search = overrides.searchTerm ?? searchTerm
    startTransition(async () => {
      const filters: Parameters<typeof getCompanyTransactions>[0] = {}
      if (p === 'overhead') {
        filters.projectId = 'null'
      } else if (p !== 'all') {
        filters.projectId = p
      }
      if (ty !== 'all') filters.type = ty
      if (pa !== 'all') filters.partyId = pa
      if (st !== 'all') filters.status = st
      if (df) filters.dateFrom = df
      if (dt) filters.dateTo = dt
      if (search.trim()) filters.search = search.trim()
      const result = await getCompanyTransactions(filters)
      setTransactions(result as unknown as CompanyTransactionRow[])
    })
  }

  const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amountBaseCurrency ?? tx.total ?? 0), 0)

  function buildExportFilters(): CompanyTransactionsExportFilters {
    const f: CompanyTransactionsExportFilters = {}
    if (projectFilter === 'overhead') f.projectId = 'null'
    else if (projectFilter !== 'all') f.projectId = projectFilter
    if (typeFilter !== 'all') f.type = typeFilter
    if (partyFilter !== 'all') f.partyId = partyFilter
    if (statusFilter !== 'all') f.status = statusFilter
    if (dateFrom) f.dateFrom = dateFrom
    if (dateTo) f.dateTo = dateTo
    if (searchTerm.trim()) f.search = searchTerm.trim()
    return f
  }

  async function handleExport(format: 'excel' | 'pdf', selectedColumns: string[]) {
    const filters = buildExportFilters()
    if (format === 'excel') return exportCompanyTransactionsToExcel(filters, selectedColumns)
    const locale = typeof window !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
    const params = new URLSearchParams({
      template: 'transactions',
      locale,
    })
    if (filters.projectId != null) params.set('projectId', String(filters.projectId))
    if (filters.type) params.set('type', filters.type)
    if (filters.partyId) params.set('partyId', filters.partyId)
    if (filters.status) params.set('status', filters.status)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.search) params.set('search', filters.search)
    const res = await fetch(`/api/pdf?${params.toString()}`, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: data?.error ?? 'No se pudo generar el PDF' }
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition')
    const match = disposition?.match(/filename="?([^";]+)"?/)
    const filename = match?.[1] ?? 'transacciones-empresa.pdf'
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    return { success: true, filename }
  }

  const exportColumns = [
    { field: 'issueDate', label: 'Fecha', defaultVisible: true },
    { field: 'transactionNumber', label: 'Número', defaultVisible: true },
    { field: 'type', label: 'Tipo', defaultVisible: true },
    { field: 'projectName', label: 'Proyecto', defaultVisible: true },
    { field: 'description', label: 'Descripción', defaultVisible: true },
    { field: 'partyName', label: 'Proveedor/Cliente', defaultVisible: true },
    { field: 'total', label: 'Monto', defaultVisible: true },
    { field: 'status', label: 'Estado', defaultVisible: true },
  ]

  return (
    <div className="space-y-4">
      {companyBalance !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Balance de la empresa:
            </span>
            <span
              className={`tabular-nums font-semibold ${
                companyBalance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(companyBalance, 'ARS')}
            </span>
          </div>
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href="/finance">Ver Dashboard</Link>
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">{t('transactions')}</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          {canCreate && (
            <Button type="button" onClick={() => setIsFormOpen(true)}>
              {t('newTransaction')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 dark:border-gray-700 dark:bg-gray-900">
        <span className="text-sm font-medium text-foreground">{t('filters')}:</span>
        <Select
          value={projectFilter}
          onValueChange={(v) => {
            setProjectFilter(v)
            applyFilters({ projectFilter: v })
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allProjects')}</SelectItem>
            <SelectItem value="overhead">Solo Generales</SelectItem>
            {filterOptions.projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.projectNumber} – {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v)
            applyFilters({ typeFilter: v })
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={partyFilter}
          onValueChange={(v) => {
            setPartyFilter(v)
            applyFilters({ partyFilter: v })
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Proveedor/Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions.parties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.partyType})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            applyFilters({ statusFilter: v })
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon('all')}</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="SUBMITTED">Enviado</SelectItem>
            <SelectItem value="APPROVED">Aprobado</SelectItem>
            <SelectItem value="PAID">Pagado</SelectItem>
            <SelectItem value="VOIDED">Anulado</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          onBlur={() => applyFilters()}
          className="max-w-[140px]"
          placeholder={tCommon('from')}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          onBlur={() => applyFilters()}
          className="max-w-[140px]"
          placeholder={tCommon('to')}
        />
        <Input
          placeholder="Buscar descripción, ref., número..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="max-w-[220px]"
        />
        <Button type="button" variant="secondary" onClick={applyFilters} disabled={isPending}>
          {isPending ? 'Filtrando...' : 'Aplicar'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left font-medium text-foreground">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Número</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Tipo doc.</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Proyecto</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Descripción</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Proveedor/Cliente</th>
              <th className="px-4 py-3 text-right font-medium text-foreground">Monto (ARS)</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Estado</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No hay transacciones que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border">
                  <td className="px-4 py-2 text-muted-foreground">{formatDateShort(tx.issueDate)}</td>
                  <td className="px-4 py-2 font-mono text-foreground">{tx.transactionNumber}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {DOCUMENT_TYPE_LABELS[tx.documentType ?? 'INVOICE'] ?? tx.documentType ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {tx.project ? (
                      <span title={tx.project.name}>{tx.project.projectNumber}</span>
                    ) : (
                      <span className="italic">Generales</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2 text-foreground" title={tx.description}>
                    {tx.description}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{tx.party?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-foreground">
                    {formatCurrency(tx.amountBaseCurrency ?? tx.total, 'ARS')}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[tx.status] ?? 'secondary'}>
                      {getStatusLabel(tx.status, tx.type)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/finance/transactions/${tx.id}`}>
                      <Button type="button" variant="ghost" size="sm">
                        {tCommon('view')}
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {transactions.length > 0 && (
        <div className="rounded-lg border border-border bg-muted p-3">
          <span className="text-sm text-foreground">
            Total: {transactions.length} transacción(es). Suma: {formatCurrency(totalAmount, 'ARS')}
          </span>
        </div>
      )}

      {canCreate && (
        <TransactionFormDialog
          projectId={null}
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSuccess={(tx) => {
            setTransactions((prev) => [tx as CompanyTransactionRow, ...prev])
            setIsFormOpen(false)
          }}
          companiesParties={filterOptions.parties}
        />
      )}

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title="Exportar transacciones de empresa (según filtros actuales)"
        columns={exportColumns}
        onExport={handleExport}
      />
    </div>
  )
}
