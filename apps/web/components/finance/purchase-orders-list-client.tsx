'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import { getProjectPurchaseOrders, type ProjectPurchaseOrderRow, type ProjectPurchaseOrdersFilters } from '@/app/actions/materials'
import { exportPurchaseOrderToExcel } from '@/app/actions/export'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { MoreHorizontal, FileDown, FileSpreadsheet, ExternalLink, Pencil } from 'lucide-react'

const PO_EXPORT_COLUMNS = ['description', 'wbsCode', 'unit', 'quantity', 'unitPrice', 'totalCost']

interface Props {
  initialItems: ProjectPurchaseOrderRow[]
  projectId: string
  parties: Array<{ id: string; name: string; partyType: string }>
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  SUBMITTED: 'Enviado',
  APPROVED: 'Aprobada',
}

export function PurchaseOrdersListClient({
  initialItems,
  projectId,
  parties,
}: Props) {
  const t = useTranslations('finance')
  const [items, setItems] = useState<ProjectPurchaseOrderRow[]>(initialItems)
  const [isPending, startTransition] = useTransition()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [partyFilter, setPartyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function downloadPdf(commitmentId: string, commitmentNumber: string) {
    setDownloadingId(commitmentId)
    try {
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const params = new URLSearchParams({
        template: 'purchase-order',
        id: commitmentId,
        locale,
        showEmitidoPor: '1',
        showFullCompanyData: '1',
      })
      const res = await fetch(`/api/pdf?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.detail ?? data?.error ?? 'No se pudo generar el PDF')
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `orden-compra-${commitmentNumber}.pdf`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setDownloadingId(null)
    }
  }

  async function downloadExcel(commitmentId: string) {
    setDownloadingId(commitmentId)
    try {
      const result = await exportPurchaseOrderToExcel(commitmentId, PO_EXPORT_COLUMNS)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (result.data && result.filename) {
        const bin = atob(result.data)
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        const blob = new Blob([arr], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = result.filename
        link.click()
        URL.revokeObjectURL(link.href)
      }
    } finally {
      setDownloadingId(null)
    }
  }

  function applyFilters(overrides?: { status?: string; partyId?: string }) {
    const status = overrides?.status ?? statusFilter
    const party = overrides?.partyId ?? partyFilter
    const filters: ProjectPurchaseOrdersFilters = {}
    if (dateFrom) filters.dateFrom = dateFrom
    if (dateTo) filters.dateTo = dateTo
    if (party !== 'all') filters.partyId = party
    if (status !== 'all') filters.status = status

    startTransition(async () => {
      const list = await getProjectPurchaseOrders(projectId, filters)
      setItems(list)
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="erp-page-title text-lg font-semibold text-foreground">
        Órdenes de compra
      </h2>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <span className="text-sm font-medium text-foreground">{t('filters')}</span>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            applyFilters({ status: v })
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="APPROVED">Aprobada</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={partyFilter}
          onValueChange={(v) => {
            setPartyFilter(v)
            applyFilters({ partyId: v })
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('supplier')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            {parties.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder={t('dueFrom')}
          className="max-w-[140px]"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder={t('dueTo')}
          className="max-w-[140px]"
        />
        <Button type="button" variant="secondary" onClick={() => applyFilters()} disabled={isPending}>
          {isPending ? t('filtering') : t('apply')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-foreground">Número</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('issueDate')}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('supplier')}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('description')}</th>
              <th className="px-4 py-3 text-right font-medium text-foreground">{t('amount')}</th>
              <th className="px-4 py-3 text-center font-medium text-foreground">Estado</th>
              <th className="w-10 px-2 py-3" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No hay órdenes de compra con los filtros aplicados.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link
                      href={`/projects/${projectId}/finance/purchase-orders/${row.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.commitmentNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDateShort(row.issueDate)}
                  </td>
                  <td className="px-4 py-2">{row.partyName}</td>
                  <td className="max-w-[200px] truncate px-4 py-2 text-muted-foreground">
                    {row.description ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(row.total, row.currency)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={row.status === 'APPROVED' ? 'default' : 'secondary'}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={downloadingId === row.id}>
                          {downloadingId === row.id ? '…' : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${projectId}/finance/purchase-orders/${row.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Ver
                          </Link>
                        </DropdownMenuItem>
                        {row.status === 'DRAFT' && (
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${projectId}/finance/purchase-orders/${row.id}/edit`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => downloadPdf(row.id, row.commitmentNumber)}>
                          <FileDown className="mr-2 h-4 w-4" />
                          Descargar PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadExcel(row.id)}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Descargar Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('itemsCount', { count: items.length })}
        </p>
      )}
    </div>
  )
}
