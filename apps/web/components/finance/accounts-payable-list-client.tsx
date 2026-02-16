'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import {
  getCompanyAccountsPayable,
  getProjectAccountsPayable,
  type AccountsPayableItem,
  type AccountsPayableFilters,
} from '@/app/actions/finance'
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

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'Factura',
  RECEIPT: 'Recibo',
  CREDIT_NOTE: 'Nota de crédito',
  DEBIT_NOTE: 'Nota de débito',
}

interface Props {
  initialItems: AccountsPayableItem[]
  filterOptions: { projects: Array<{ id: string; name: string; projectNumber: string }>; parties: Array<{ id: string; name: string; partyType: string }> }
  projectId?: string | null
  title?: string
}

export function AccountsPayableListClient({
  initialItems,
  filterOptions,
  projectId = null,
  title = 'Cuentas por pagar',
}: Props) {
  const t = useTranslations('common')
  const [items, setItems] = useState<AccountsPayableItem[]>(initialItems)
  const [isPending, startTransition] = useTransition()
  const [dueDateFrom, setDueDateFrom] = useState('')
  const [dueDateTo, setDueDateTo] = useState('')
  const [partyFilter, setPartyFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState(projectId ?? 'all')
  const isProjectScope = projectId != null

  function applyFilters() {
    const filters: AccountsPayableFilters = {}
    if (dueDateFrom) filters.dueDateFrom = dueDateFrom
    if (dueDateTo) filters.dueDateTo = dueDateTo
    if (partyFilter !== 'all') filters.partyId = partyFilter
    if (!isProjectScope && projectFilter !== 'all') filters.projectId = projectFilter

    startTransition(async () => {
      const list = isProjectScope && projectId
        ? await getProjectAccountsPayable(projectId, filters)
        : await getCompanyAccountsPayable(filters)
      setItems(list)
    })
  }

  const totalAmount = items.reduce((sum, tx) => sum + (tx.amountBaseCurrency ?? tx.total ?? 0), 0)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <span className="text-sm font-medium text-foreground">Filtros:</span>
        {!isProjectScope && (
          <Select
            value={projectFilter}
            onValueChange={(v) => {
              setProjectFilter(v)
              applyFilters()
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {filterOptions.projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.projectNumber} – {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={partyFilter}
          onValueChange={(v) => {
            setPartyFilter(v)
            applyFilters()
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Proveedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions.parties.filter((p) => p.partyType === 'SUPPLIER').map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueDateFrom}
          onChange={(e) => setDueDateFrom(e.target.value)}
          placeholder="Venc. desde"
          className="max-w-[140px]"
        />
        <Input
          type="date"
          value={dueDateTo}
          onChange={(e) => setDueDateTo(e.target.value)}
          placeholder="Venc. hasta"
          className="max-w-[140px]"
        />
        <Button type="button" variant="secondary" onClick={applyFilters} disabled={isPending}>
          {isPending ? 'Filtrando...' : 'Aplicar'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-foreground">Número</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Emisión</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Vencimiento</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Tipo doc.</th>
              {!isProjectScope && <th className="px-4 py-3 text-left font-medium text-foreground">Proyecto</th>}
              <th className="px-4 py-3 text-left font-medium text-foreground">Proveedor</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Descripción</th>
              <th className="px-4 py-3 text-right font-medium text-foreground">Monto</th>
              <th className="px-4 py-3 text-center font-medium text-foreground">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isProjectScope ? 8 : 9} className="px-4 py-8 text-center text-muted-foreground">
                  No hay cuentas por pagar con los filtros aplicados.
                </td>
              </tr>
            ) : (
              items.map((tx) => {
                const due = tx.dueDate ? new Date(tx.dueDate) : null
                const daysUntilDue = due ? Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
                return (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link href={`/finance/transactions/${tx.id}`} className="font-medium text-primary hover:underline">
                        {tx.transactionNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDateShort(tx.issueDate)}</td>
                    <td className="px-4 py-2">{tx.dueDate ? formatDateShort(tx.dueDate) : '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{DOCUMENT_TYPE_LABELS[tx.documentType] ?? tx.documentType}</td>
                    {!isProjectScope && (
                      <td className="px-4 py-2 text-muted-foreground">{tx.project?.name ?? 'Overhead'}</td>
                    )}
                    <td className="px-4 py-2">{tx.party?.name ?? '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-muted-foreground">{tx.description}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(tx.amountBaseCurrency ?? tx.total, tx.currency)}</td>
                    <td className="px-4 py-2 text-center">
                      {daysUntilDue != null && (
                        <Badge variant={daysUntilDue <= 0 ? 'destructive' : daysUntilDue <= 7 ? 'secondary' : 'outline'}>
                          {daysUntilDue <= 0 ? 'Vencido' : `${daysUntilDue} días`}
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Total: {formatCurrency(totalAmount)} ({items.length} ítem(s))
        </p>
      )}
    </div>
  )
}
