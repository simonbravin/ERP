'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import {
  updateFinanceTransactionSchema,
  type UpdateFinanceTransactionInput,
  type CreateFinanceLineInput,
} from '@repo/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyConverter } from './currency-converter'
import { TransactionLineForm, type LineInput } from './transaction-line-form'
import { DOCUMENT_TYPE_LABELS, TYPE_LABELS } from '@/lib/finance-labels'

type WbsOption = { id: string; code: string; name: string }

type TransactionEditClientProps = {
  transactionId: string
  transaction: {
    id: string
    type: string
    documentType?: string | null
    description: string
    issueDate: Date
    dueDate?: Date | null
    projectId: string | null
    partyId: string | null
    party?: { id: string; name: string } | null
    currency: string
    total: number
    amountBaseCurrency: number
    exchangeRateSnapshot: unknown
    reference: string | null
    lines: Array<{
      id: string
      description: string
      lineTotal: number
      wbsNode: { id: string; code: string; name: string } | null
    }>
  }
  wbsOptions: WbsOption[]
  updateTransaction: (id: string, data: UpdateFinanceTransactionInput) => Promise<{ error?: Record<string, string[]> } | { success: boolean }>
  addLine: (transactionId: string, data: CreateFinanceLineInput) => Promise<{ error?: Record<string, string[]> } | { success: boolean }>
  updateLine: (lineId: string, data: { description?: string; amount?: number; wbsNodeId?: string | null }) => Promise<{ error?: Record<string, string[]> } | { success: boolean }>
  deleteLine: (lineId: string) => Promise<unknown>
  fetchWbs: (projectId: string) => Promise<WbsOption[]>
}

const rateFromTx = (snap: unknown): number =>
  (snap as { rate?: number })?.rate ?? 1

export function TransactionEditClient({
  transactionId,
  transaction,
  wbsOptions: initialWbs,
  updateTransaction,
  addLine,
  updateLine,
  deleteLine,
  fetchWbs,
}: TransactionEditClientProps) {
  const router = useRouter()
  const t = useTranslations('finance')
  const tCommon = useTranslations('common')
  const [wbsOptions, setWbsOptions] = useState<WbsOption[]>(initialWbs)
  const [exchangeRate, setExchangeRate] = useState(rateFromTx(transaction.exchangeRateSnapshot))
  const {
    register,
    watch,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateFinanceTransactionInput>({
    resolver: zodResolver(updateFinanceTransactionSchema),
    defaultValues: {
      description: transaction.description,
      issueDate: transaction.issueDate.toISOString().slice(0, 10) as unknown as Date,
      dueDate: transaction.dueDate ? new Date(transaction.dueDate).toISOString().slice(0, 10) as unknown as Date : undefined,
      documentType: (transaction.documentType ?? 'INVOICE') as UpdateFinanceTransactionInput['documentType'],
      projectId: transaction.projectId ?? undefined,
      partyId: transaction.partyId ?? undefined,
      currencyCode: transaction.currency,
      exchangeRateSnapshot: rateFromTx(transaction.exchangeRateSnapshot),
      reference: transaction.reference ?? undefined,
    },
  })

  const projectId = watch('projectId')
  const currencyCode = watch('currencyCode')
  useEffect(() => {
    if (!projectId) {
      setWbsOptions(initialWbs)
      return
    }
    fetchWbs(projectId).then(setWbsOptions).catch(() => setWbsOptions([]))
  }, [projectId, fetchWbs])

  const totalFromLines = transaction.lines.reduce((s, l) => s + l.lineTotal, 0)
  const baseAmount = totalFromLines * exchangeRate

  async function onHeaderSubmit(data: UpdateFinanceTransactionInput) {
    const result = await updateTransaction(transactionId, {
      ...data,
      exchangeRateSnapshot: exchangeRate,
    })
    if (result && 'error' in result && result.error) {
      Object.entries(result.error).forEach(([field, messages]) => {
        if (field !== '_form' && messages?.[0])
          setError(field as keyof UpdateFinanceTransactionInput, { message: messages[0] })
      })
      return
    }
    reset(data, { keepValues: true })
    router.refresh()
  }

  async function onAddLine(line: LineInput) {
    const result = await addLine(transactionId, {
      description: line.description,
      amount: line.amount,
      wbsNodeId: line.wbsNodeId ?? undefined,
      unit: line.unit ?? 'ea',
      quantity: line.quantity ?? 1,
    })
    if (result && 'error' in result && result.error) {
      alert(Object.values(result.error).flat().join(', '))
      return
    }
    router.refresh()
  }

  async function onDeleteLine(lineId: string) {
    await deleteLine(lineId)
    router.refresh()
  }

  return (
    <div className="erp-form-page space-y-6">
      <form onSubmit={handleSubmit(onHeaderSubmit)} className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">{t('transactions')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">{t('type')}</Label>
            <p className="mt-1 text-sm font-medium text-foreground">
              {TYPE_LABELS[transaction.type] ?? transaction.type.replace(/_/g, ' ')}
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              {transaction.type === 'INCOME' || transaction.type === 'SALE' ? t('client') : t('vendor')}
            </Label>
            <p className="mt-1 text-sm text-foreground">{transaction.party?.name ?? '—'}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-muted-foreground">{t('documentType')}</Label>
            <p className="mt-1 text-sm text-foreground">
              {DOCUMENT_TYPE_LABELS[transaction.documentType ?? 'INVOICE'] ?? (transaction.documentType ?? 'INVOICE')}
            </p>
          </div>
          <div>
            <Label htmlFor="edit-date" className="text-sm font-medium text-muted-foreground">{t('date')}</Label>
            <Input id="edit-date" type="date" {...register('issueDate')} className="mt-1 min-h-10" />
          </div>
          <div>
            <Label htmlFor="edit-due" className="text-sm font-medium text-muted-foreground">{t('dueDate')}</Label>
            <Input id="edit-due" type="date" {...register('dueDate')} className="mt-1 min-h-10" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-desc" className="text-sm font-medium text-muted-foreground">{t('description')}</Label>
            <Input id="edit-desc" {...register('description')} className="mt-1 min-h-10" />
            {errors.description && (
              <p className="mt-1 text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="edit-currency" className="text-sm font-medium text-muted-foreground">{t('currency')}</Label>
            <select
              id="edit-currency"
              {...register('currencyCode')}
              className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value={transaction.currency}>{transaction.currency}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="edit-rate" className="text-sm font-medium text-muted-foreground">{t('baseCurrency')}</Label>
            <Input
              id="edit-rate"
              type="number"
              min={0.000001}
              step={0.01}
              value={exchangeRate}
              onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
              className="mt-1 min-h-10"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-ref" className="text-sm font-medium text-muted-foreground">{t('reference')}</Label>
            <Input id="edit-ref" {...register('reference')} className="mt-1 min-h-10" />
          </div>
        </div>
        <div className="mt-4">
          <CurrencyConverter
            amount={totalFromLines}
            currencyCode={currencyCode ?? transaction.currency}
            exchangeRate={exchangeRate}
            baseAmount={baseAmount}
            readOnly
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? t('saving') : tCommon('save')}
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-foreground">{t('lines')}</h3>
        <TransactionLineForm wbsOptions={wbsOptions} onAdd={onAddLine} projectId={transaction.projectId ?? null} />
        {transaction.lines.length > 0 && (
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 font-medium text-muted-foreground">{t('description')}</th>
                  <th className="py-3 font-medium text-muted-foreground">WBS</th>
                  <th className="py-3 text-right font-medium text-muted-foreground">{t('amount')}</th>
                  <th className="w-24 py-3" />
                </tr>
              </thead>
              <tbody>
                {transaction.lines.map((line) => (
                  <tr key={line.id} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{line.description}</td>
                    <td className="py-2 font-mono text-muted-foreground">
                      {line.wbsNode ? `${line.wbsNode.code} ${line.wbsNode.name}` : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {line.lineTotal.toFixed(2)}
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => onDeleteLine(line.id)}
                      >
                        {tCommon('remove')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
