'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import { getProjectPurchaseOrders, type ProjectPurchaseOrderRow, type ProjectPurchaseOrdersFilters } from '@/app/actions/materials'
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
      <h2 className="text-lg font-semibold text-foreground">
        Órdenes de compra
      </h2>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
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
        <Button type="button" variant="secondary" onClick={applyFilters} disabled={isPending}>
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
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
