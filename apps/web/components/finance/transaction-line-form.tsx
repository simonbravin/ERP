'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslations } from 'next-intl'
import { getWBSBudgetAndConsumed } from '@/app/actions/finance'
import { formatCurrency } from '@/lib/format-utils'

export type LineInput = {
  description: string
  amount: number
  wbsNodeId?: string | null
  unit?: string | null
  quantity?: number
}

type WbsOption = { id: string; code: string; name: string }

type TransactionLineFormProps = {
  wbsOptions: WbsOption[]
  onAdd: (line: LineInput) => void
  disabled?: boolean
  /** When set, shows presupuesto/consumido/disponible for selected WBS and warns if line amount exceeds available */
  projectId?: string | null
}

export function TransactionLineForm({
  wbsOptions,
  onAdd,
  disabled,
  projectId,
}: TransactionLineFormProps) {
  const t = useTranslations('finance')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [wbsNodeId, setWbsNodeId] = useState<string>('')
  const [unit, setUnit] = useState('ea')
  const [wbsBudgetConsumed, setWbsBudgetConsumed] = useState<{
    budgeted: number
    consumed: number
    available: number
  } | null>(null)

  useEffect(() => {
    if (!projectId || !wbsNodeId) {
      setWbsBudgetConsumed(null)
      return
    }
    getWBSBudgetAndConsumed(projectId, wbsNodeId)
      .then((data) => setWbsBudgetConsumed(data ?? null))
      .catch(() => setWbsBudgetConsumed(null))
  }, [projectId, wbsNodeId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!description.trim() || isNaN(amt) || amt < 0) return
    onAdd({
      description: description.trim(),
      amount: amt,
      wbsNodeId: wbsNodeId || undefined,
      unit: unit || 'ea',
      quantity: 1,
    })
    setDescription('')
    setAmount('')
    setWbsNodeId('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
    >
      <div className="min-w-[280px] flex-1">
        <Label htmlFor="line-desc">Description</Label>
        <Input
          id="line-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Line description"
          disabled={disabled}
          className="mt-0.5"
        />
      </div>
      <div className="min-w-[120px]">
        <Label htmlFor="line-amount">Amount</Label>
        <CurrencyInput
          id="line-amount"
          value={amount}
          onChange={setAmount}
          disabled={disabled}
          className="mt-0.5"
        />
      </div>
      {wbsOptions.length > 0 && (
        <div className="min-w-[200px]">
          <Label htmlFor="line-wbs">
            {t('lineWbsLabel', { defaultValue: 'Ítem WBS (afecta esta compra al ítem)' })}
          </Label>
          <select
            id="line-wbs"
            value={wbsNodeId}
            onChange={(e) => setWbsNodeId(e.target.value)}
            disabled={disabled}
            className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="">— {t('none', { defaultValue: 'Ninguno' })} —</option>
            {wbsOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.code} {n.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('lineWbsHelp', {
              defaultValue: 'Asignar WBS vincula esta línea al ítem del presupuesto para trazabilidad y reportes.',
            })}
          </p>
          {wbsBudgetConsumed != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('wbsItemBudget', {
                defaultValue: 'Presupuesto ítem',
              })}
              : {formatCurrency(wbsBudgetConsumed.budgeted, 'ARS')} |{' '}
              {t('consumed', { defaultValue: 'Consumido' })}: {formatCurrency(wbsBudgetConsumed.consumed, 'ARS')} |{' '}
              {t('available', { defaultValue: 'Disponible' })}: {formatCurrency(wbsBudgetConsumed.available, 'ARS')}
            </p>
          )}
          {wbsBudgetConsumed != null && amount !== '' && !isNaN(parseFloat(amount)) && parseFloat(amount) > wbsBudgetConsumed.available && (
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-500">
              {t('lineExceedsAvailable', { defaultValue: 'Esta línea supera el disponible del ítem.' })}
            </p>
          )}
        </div>
      )}
      <Button type="submit" disabled={disabled || !description.trim() || amount == null}>
        {t('addLine', { defaultValue: 'Agregar línea' })}
      </Button>
    </form>
  )
}
