'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createFinanceTransactionSchema,
  TRANSACTION_TYPE,
  type CreateFinanceTransactionInput,
} from '@repo/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyConverter } from './currency-converter'
import { TransactionLineForm, type LineInput } from './transaction-line-form'

type ProjectOption = { id: string; name: string }
type PartyOption = { id: string; name: string }
type WbsOption = { id: string; code: string; name: string }

type TransactionFormProps = {
  projects: ProjectOption[]
  parties: PartyOption[]
  currencies: { code: string; name: string; symbol: string }[]
  /** Pass either static wbsOptions or fetchWbs(projectId) to load when project changes */
  wbsOptions?: WbsOption[]
  fetchWbs?: (projectId: string) => Promise<WbsOption[]>
  onSubmit: (
    data: CreateFinanceTransactionInput,
    lines: LineInput[]
  ) => Promise<{ error?: Record<string, string[]> } | { success: boolean; id?: string }>
  onCancelHref: string
}

const today = new Date().toISOString().slice(0, 10)

export function TransactionForm({
  projects,
  parties,
  currencies,
  wbsOptions: initialWbs = [],
  fetchWbs,
  onSubmit,
  onCancelHref,
}: TransactionFormProps) {
  const [lines, setLines] = useState<LineInput[]>([])
  const [wbsOptions, setWbsOptions] = useState<WbsOption[]>(initialWbs)
  const {
    register,
    watch,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateFinanceTransactionInput>({
    resolver: zodResolver(createFinanceTransactionSchema),
    defaultValues: {
      type: 'EXPENSE',
      description: '',
      issueDate: today as unknown as Date,
      projectId: null,
      partyId: null,
      currencyCode: 'USD',
      exchangeRateSnapshot: 1,
      reference: '',
    },
  })

  const projectId = watch('projectId')
  const currencyCode = watch('currencyCode')
  const exchangeRateSnapshot = watch('exchangeRateSnapshot') ?? 1
  const totalFromLines = lines.reduce((s, l) => s + l.amount, 0)
  const baseAmount = totalFromLines * exchangeRateSnapshot

  useEffect(() => {
    if (!projectId || !fetchWbs) {
      setWbsOptions([])
      return
    }
    fetchWbs(projectId).then(setWbsOptions).catch(() => setWbsOptions([]))
  }, [projectId])

  const wbsOptionsToUse = wbsOptions

  function handleAddLine(line: LineInput) {
    setLines((prev) => [...prev, line])
  }

  function handleRemoveLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleFormSubmit(data: CreateFinanceTransactionInput) {
    const result = await onSubmit(data, lines)
    if (result && 'error' in result && result.error) {
      if (result.error._form) setError('root', { message: result.error._form[0] })
      Object.entries(result.error).forEach(([field, messages]) => {
        if (field !== '_form' && messages?.[0])
          setError(field as keyof CreateFinanceTransactionInput, { message: messages[0] })
      })
      return
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="erp-form-page space-y-6">
      <div className="erp-card p-4">
        <h3 className="mb-4 text-sm font-medium text-foreground">Transaction</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tx-type">Type</Label>
            <select
              id="tx-type"
              {...register('type')}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              {TRANSACTION_TYPE.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tx-date">Issue date</Label>
            <Input id="tx-date" type="date" {...register('issueDate')} className="mt-1" />
            {errors.issueDate && (
              <p className="mt-1 text-sm text-destructive">{errors.issueDate.message}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="tx-desc">Description</Label>
            <Input id="tx-desc" {...register('description')} className="mt-1" placeholder="Transaction description" />
            {errors.description && (
              <p className="mt-1 text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="tx-project">Project (optional)</Label>
            <select
              id="tx-project"
              {...register('projectId')}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tx-vendor">Vendor (optional)</Label>
            <select
              id="tx-vendor"
              {...register('partyId')}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tx-currency">Currency</Label>
            <select
              id="tx-currency"
              {...register('currencyCode')}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tx-rate">Exchange rate to base (USD)</Label>
            <Input
              id="tx-rate"
              type="number"
              min={0.000001}
              step={0.01}
              {...register('exchangeRateSnapshot', { valueAsNumber: true })}
              className="mt-1"
            />
            {errors.exchangeRateSnapshot && (
              <p className="mt-1 text-sm text-destructive">{errors.exchangeRateSnapshot.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="erp-card p-4">
        <h3 className="mb-4 text-sm font-medium text-foreground">Lines</h3>
        <TransactionLineForm wbsOptions={wbsOptionsToUse} onAdd={handleAddLine} projectId={projectId ?? null} />
        {lines.length > 0 && (
          <div className="mt-4">
            <table className="erp-table w-full text-sm">
              <thead>
                <tr className="erp-table-header">
                  <th className="erp-table-cell">Description</th>
                  <th className="erp-table-cell-numeric">Amount</th>
                  <th className="erp-table-cell w-20" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="erp-table-row">
                    <td className="erp-table-cell text-foreground">{line.description}</td>
                    <td className="erp-table-cell-numeric text-foreground">
                      {line.amount.toFixed(2)}
                    </td>
                    <td className="erp-table-cell">
                      <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => handleRemoveLine(i)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-end border-t border-border pt-2">
              <CurrencyConverter
                amount={totalFromLines}
                currencyCode={currencyCode}
                exchangeRate={exchangeRateSnapshot}
                baseAmount={baseAmount}
                readOnly
              />
            </div>
          </div>
        )}
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground">Add at least one line.</p>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting || lines.length === 0}>
          {isSubmitting ? 'Saving…' : 'Save as draft'}
        </Button>
        <a href={onCancelHref}>
          <Button type="button" variant="outline">Cancel</Button>
        </a>
      </div>
    </form>
  )
}
