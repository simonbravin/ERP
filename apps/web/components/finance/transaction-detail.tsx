'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CurrencyConverter } from './currency-converter'
import { DOCUMENT_TYPE_LABELS, STATUS_LABELS } from '@/lib/finance-labels'
import { cn } from '@/lib/utils'

export type TransactionDetailData = {
  id: string
  transactionNumber: string
  type: string
  documentType?: string
  status: string
  issueDate: Date
  dueDate?: Date | null
  description: string
  reference: string | null
  currency: string
  total: number
  amountBaseCurrency: number
  retentionAmount?: number
  adjustmentAmount?: number
  adjustmentNotes?: string | null
  exchangeRateSnapshot: unknown
  project: { id: string; name: string } | null
  party: { id: string; name: string } | null
  createdBy: { user: { fullName: string } }
  lines: Array<{
    id: string
    description: string
    lineTotal: number
    wbsNode: { id: string; code: string; name: string } | null
  }>
}

type TransactionDetailProps = {
  transaction: TransactionDetailData
  canEdit: boolean
  canApprove: boolean
  canMarkPaid: boolean
  canVoid: boolean
  onSubmit: (id: string) => Promise<{ error?: string } | { success: boolean }>
  onApprove: (id: string) => Promise<{ error?: string } | { success: boolean }>
  onReject: (id: string, reason: string) => Promise<{ error?: string } | { success: boolean }>
  onMarkPaid: (id: string, date: Date) => Promise<{ error?: string } | { success: boolean }>
  onVoid: (id: string, reason: string) => Promise<{ error?: string } | { success: boolean }>
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-muted text-muted-foreground',
    SUBMITTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    PAID: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    VOIDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span
      className={cn(
        'rounded-md px-2.5 py-1 text-sm font-medium',
        styles[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function TransactionDetail({
  transaction,
  canEdit,
  canApprove,
  canMarkPaid,
  canVoid,
  onSubmit,
  onApprove,
  onReject,
  onMarkPaid,
  onVoid,
}: TransactionDetailProps) {
  const router = useRouter()
  const [rejectReason, setRejectReason] = useState('')
  const [voidReason, setVoidReason] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState<string | null>(null)
  const rate = (transaction.exchangeRateSnapshot as { rate?: number })?.rate ?? 1
  const t = useTranslations('finance')
  const isClientParty = transaction.type === 'INCOME' || transaction.type === 'SALE'
  const partyLabel = isClientParty ? t('client') : t('vendor')

  async function handle(action: string, fn: () => Promise<{ error?: string } | { success: boolean }>) {
    setLoading(action)
    const result = await fn()
    setLoading(null)
    if (result && 'error' in result) alert(result.error)
    else router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {transaction.transactionNumber} — {transaction.type.replace(/_/g, ' ')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('createdBy')} {transaction.createdBy.user.fullName} · {formatDate(transaction.issueDate)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={transaction.status} />
          {canEdit && transaction.status === 'DRAFT' && (
            <Link href={`/finance/transactions/${transaction.id}/edit`}>
              <Button variant="outline" size="default">{t('edit')}</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">{t('description')}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{transaction.description}</dd>
          </div>
          {transaction.documentType && (
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('documentType')}</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {DOCUMENT_TYPE_LABELS[transaction.documentType] ?? transaction.documentType}
              </dd>
            </div>
          )}
          {transaction.dueDate && (
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('dueDate')}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{formatDate(transaction.dueDate)}</dd>
            </div>
          )}
          {transaction.reference && (
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('reference')}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{transaction.reference}</dd>
            </div>
          )}
          {transaction.project && (
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('project')}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{transaction.project.name}</dd>
            </div>
          )}
          {transaction.party && (
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{partyLabel}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{transaction.party.name}</dd>
            </div>
          )}
          {(transaction.retentionAmount != null && transaction.retentionAmount !== 0) && (
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('retention')}</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {formatCurrency(transaction.retentionAmount, transaction.currency)}
              </dd>
            </div>
          )}
          {(transaction.adjustmentAmount != null && transaction.adjustmentAmount !== 0) && (
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('adjustment')}</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {formatCurrency(transaction.adjustmentAmount, transaction.currency)}
              </dd>
            </div>
          )}
          {transaction.adjustmentNotes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('adjustmentNotes')}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{transaction.adjustmentNotes}</dd>
            </div>
          )}
        </dl>
        <div className="mt-4">
          <CurrencyConverter
            amount={transaction.total}
            currencyCode={transaction.currency}
            exchangeRate={rate}
            baseAmount={transaction.amountBaseCurrency}
            readOnly
          />
        </div>
      </div>

      {transaction.lines.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <h2 className="border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium text-foreground">
            {t('lines')}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('description')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">WBS</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {transaction.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/50">
                  <td className="px-4 py-2 text-foreground">{line.description}</td>
                  <td className="px-4 py-2 font-mono text-muted-foreground">
                    {line.wbsNode ? `${line.wbsNode.code} ${line.wbsNode.name}` : '—'}
                  </td>
                  <td className="text-right tabular-nums text-foreground">
                    {formatCurrency(line.lineTotal, transaction.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('actions')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('flowHint')}</p>
        </div>
        {transaction.status === 'DRAFT' && canEdit && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="default"
              onClick={() => handle('submit', () => onSubmit(transaction.id))}
              disabled={!!loading}
            >
              {loading === 'submit' ? t('submitting') : t('submit')}
            </Button>
          </div>
        )}
        {transaction.status === 'SUBMITTED' && canApprove && (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <Button
              size="default"
              onClick={() => handle('approve', () => onApprove(transaction.id))}
              disabled={!!loading}
            >
              {loading === 'approve' ? t('approving') : t('approve')}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 sm:min-w-[280px] sm:max-w-md">
                <Label htmlFor="reject-reason" className="text-sm font-medium text-foreground">{t('rejectionReason')}</Label>
                <Textarea
                  id="reject-reason"
                  placeholder={t('rejectionReason')}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="mt-1.5 min-h-[100px] w-full resize-y"
                />
              </div>
              <Button
                variant="outline"
                size="default"
                onClick={() => handle('reject', () => onReject(transaction.id, rejectReason))}
                disabled={!!loading || !rejectReason.trim()}
              >
                {loading === 'reject' ? t('rejecting') : t('reject')}
              </Button>
            </div>
          </div>
        )}
        {transaction.status === 'APPROVED' && canMarkPaid && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 sm:max-w-[200px]">
              <Label htmlFor="payment-date" className="text-sm font-medium text-foreground">{t('paymentDate')}</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-1.5 min-h-10"
              />
            </div>
            <Button
              size="default"
              onClick={() => handle('paid', () => onMarkPaid(transaction.id, new Date(paymentDate)))}
              disabled={!!loading}
            >
              {loading === 'paid' ? t('saving') : t('markAsPaid')}
            </Button>
          </div>
        )}
        {transaction.status !== 'VOIDED' && canVoid && (
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 sm:min-w-[280px] sm:max-w-md">
              <Label htmlFor="void-reason" className="text-sm font-medium text-foreground">{t('voidReason')}</Label>
              <Textarea
                id="void-reason"
                placeholder={t('voidReason')}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={4}
                className="mt-1.5 min-h-[100px] w-full resize-y"
              />
            </div>
            <Button
              variant="outline"
              size="default"
              onClick={() => handle('void', () => onVoid(transaction.id, voidReason))}
              disabled={!!loading || !voidReason.trim()}
            >
              {loading === 'void' ? t('voiding') : t('void')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
