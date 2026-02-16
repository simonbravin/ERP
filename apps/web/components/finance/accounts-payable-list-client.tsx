'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
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
import { DOCUMENT_TYPE_LABELS } from '@/lib/finance-labels'

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
  const t = useTranslations('finance')
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
        <span className="text-sm font-medium text-foreground">{t('filters')}</span>
        {!isProjectScope && (
          <Select
            value={projectFilter}
            onValueChange={(v) => {
              setProjectFilter(v)
              applyFilters()
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('project')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allProjects')}</SelectItem>
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
            <SelectValue placeholder={t('supplier')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            {filterOptions.parties.filter((p) => p.partyType === 'SUPPLIER').map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueDateFrom}
          onChange={(e) => setDueDateFrom(e.target.value)}
          placeholder={t('dueFrom')}
          className="max-w-[140px]"
        />
        <Input
          type="date"
          value={dueDateTo}
          onChange={(e) => setDueDateTo(e.target.value)}
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
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('numberShort')}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('issueDate')}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('dueDateShort')}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('docType')}</th>
              {!isProjectScope && <th className="px-4 py-3 text-left font-medium text-foreground">{t('project')}</th>}
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('supplier')}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t('description')}</th>
              <th className="px-4 py-3 text-right font-medium text-foreground">{t('amount')}</th>
              <th className="px-4 py-3 text-center font-medium text-foreground">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isProjectScope ? 8 : 9} className="px-4 py-8 text-center text-muted-foreground">
                  {t('noPayableResults')}
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
                          {daysUntilDue <= 0 ? t('overdue') : t('daysUntilDue', { days: daysUntilDue })}
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
          {t('totalItems')}: {formatCurrency(totalAmount)} ({t('itemsCount', { count: items.length })})
        </p>
      )}
    </div>
  )
}
