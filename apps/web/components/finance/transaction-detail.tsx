'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyConverter } from './currency-converter'
import { cn } from '@/lib/utils'

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'Factura',
  RECEIPT: 'Recibo',
  CREDIT_NOTE: 'Nota de crédito',
  DEBIT_NOTE: 'Nota de débito',
}

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
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    SUBMITTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    PAID: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    VOIDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-xs font-medium',
        styles[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      )}
    >
      {status}
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {transaction.transactionNumber} — {transaction.type.replace(/_/g, ' ')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Created by {transaction.createdBy.user.fullName} · {formatDate(transaction.issueDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={transaction.status} />
          {canEdit && transaction.status === 'DRAFT' && (
            <Link href={`/finance/transactions/${transaction.id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Description</dt>
            <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{transaction.description}</dd>
          </div>
          {transaction.documentType && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Tipo de documento</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">
                {DOCUMENT_TYPE_LABELS[transaction.documentType] ?? transaction.documentType}
              </dd>
            </div>
          )}
          {transaction.dueDate && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Fecha de vencimiento</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDate(transaction.dueDate)}</dd>
            </div>
          )}
          {transaction.reference && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Reference</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{transaction.reference}</dd>
            </div>
          )}
          {transaction.project && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Project</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{transaction.project.name}</dd>
            </div>
          )}
          {transaction.party && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Vendor</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{transaction.party.name}</dd>
            </div>
          )}
          {(transaction.retentionAmount != null && transaction.retentionAmount !== 0) && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Retención</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">
                {formatCurrency(transaction.retentionAmount, transaction.currency)}
              </dd>
            </div>
          )}
          {(transaction.adjustmentAmount != null && transaction.adjustmentAmount !== 0) && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ajuste</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">
                {formatCurrency(transaction.adjustmentAmount, transaction.currency)}
              </dd>
            </div>
          )}
          {transaction.adjustmentNotes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Notas de ajuste</dt>
              <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{transaction.adjustmentNotes}</dd>
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
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
            Lines
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">WBS</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transaction.lines.map((line) => (
                <tr key={line.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{line.description}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">
                    {line.wbsNode ? `${line.wbsNode.code} ${line.wbsNode.name}` : '—'}
                  </td>
                  <td className="text-right tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(line.lineTotal, transaction.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Actions</h3>
        {transaction.status === 'DRAFT' && canEdit && (
          <Button
            onClick={() => handle('submit', () => onSubmit(transaction.id))}
            disabled={!!loading}
          >
            {loading === 'submit' ? 'Submitting…' : 'Submit'}
          </Button>
        )}
        {transaction.status === 'SUBMITTED' && canApprove && (
          <div className="flex flex-wrap items-end gap-2">
            <Button
              onClick={() => handle('approve', () => onApprove(transaction.id))}
              disabled={!!loading}
            >
              {loading === 'approve' ? 'Approving…' : 'Approve'}
            </Button>
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="reject-reason" className="sr-only">Rejection reason</Label>
                <Input
                  id="reject-reason"
                  placeholder="Rejection reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => handle('reject', () => onReject(transaction.id, rejectReason))}
                disabled={!!loading || !rejectReason.trim()}
              >
                {loading === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
        {transaction.status === 'APPROVED' && canMarkPaid && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="payment-date">Payment date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-0.5"
              />
            </div>
            <Button
              onClick={() => handle('paid', () => onMarkPaid(transaction.id, new Date(paymentDate)))}
              disabled={!!loading}
            >
              {loading === 'paid' ? 'Saving…' : 'Mark as paid'}
            </Button>
          </div>
        )}
        {transaction.status !== 'VOIDED' && canVoid && (
          <div className="flex flex-wrap items-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <div>
              <Label htmlFor="void-reason">Void reason</Label>
              <Input
                id="void-reason"
                placeholder="Reason for voiding"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="mt-0.5 max-w-xs"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => handle('void', () => onVoid(transaction.id, voidReason))}
              disabled={!!loading || !voidReason.trim()}
            >
              {loading === 'void' ? 'Voiding…' : 'Void'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
