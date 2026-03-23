'use client'

import { useForm, FormProvider, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createBudgetLineSchema,
  type CreateBudgetLineInput,
} from '@repo/validators'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResourceSelector } from '@/components/resources/resource-selector'

type WbsOption = { id: string; code: string; name: string }

type BudgetLineFormProps = {
  versionId: string
  wbsOptions: WbsOption[]
  defaultIndirectPct?: number
  onSubmit: (data: CreateBudgetLineInput) => Promise<{ error?: Record<string, string[]> } | { success: boolean }>
  onCancel?: () => void
}

export function BudgetLineForm({
  versionId: _versionId,
  wbsOptions,
  defaultIndirectPct = 0,
  onSubmit,
  onCancel,
}: BudgetLineFormProps) {
  const methods = useForm<CreateBudgetLineInput>({
    resolver: zodResolver(createBudgetLineSchema),
    defaultValues: {
      wbsNodeId: '',
      resourceId: null,
      description: '',
      unit: '',
      quantity: 1,
      unitCost: 0,
      indirectCostPct: defaultIndirectPct,
    },
  })

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = methods

  async function handleFormSubmit(data: CreateBudgetLineInput) {
    const result = await onSubmit(data)
    if (result && 'error' in result && result.error) {
      Object.entries(result.error).forEach(([field, messages]) => {
        if (messages?.[0]) setError(field as keyof CreateBudgetLineInput, { message: messages[0] })
      })
      return
    }
    reset({
      wbsNodeId: data.wbsNodeId,
      resourceId: null,
      description: '',
      unit: data.unit,
      quantity: 1,
      unitCost: 0,
      indirectCostPct: defaultIndirectPct,
    })
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
      >
        <div className="min-w-[140px]">
          <Label htmlFor="line-wbs">WBS</Label>
          <select
            id="line-wbs"
            {...register('wbsNodeId')}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="">Select WBS</option>
            {wbsOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} {w.name}
              </option>
            ))}
          </select>
          {errors.wbsNodeId && (
            <p className="mt-1 text-xs text-destructive">{errors.wbsNodeId.message}</p>
          )}
        </div>
        <div className="min-w-[240px]">
          <ResourceSelector
            name="resourceId"
            unitCostName="unitCost"
            unitName="unit"
            descriptionName="description"
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="line-desc">Description</Label>
          <Input id="line-desc" {...register('description')} className="mt-1" placeholder="Line description" />
          {errors.description && (
            <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>
        <div className="w-20">
          <Label htmlFor="line-unit">Unit</Label>
          <Input id="line-unit" {...register('unit')} className="mt-1" placeholder="ea" />
          {errors.unit && <p className="mt-1 text-xs text-destructive">{errors.unit.message}</p>}
        </div>
        <div className="w-24">
          <Label htmlFor="line-qty">Qty</Label>
          <Input id="line-qty" type="number" step="any" {...register('quantity')} className="mt-1" />
          {errors.quantity && (
            <p className="mt-1 text-xs text-destructive">{errors.quantity.message}</p>
          )}
        </div>
        <div className="w-28">
          <Label htmlFor="line-unitcost">Unit cost</Label>
          <Controller
            name="unitCost"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                id="line-unitcost"
                value={field.value ?? null}
                onChange={field.onChange}
                className="mt-1"
              />
            )}
          />
          {errors.unitCost && (
            <p className="mt-1 text-xs text-destructive">{errors.unitCost.message}</p>
          )}
        </div>
        <div className="w-20">
          <Label htmlFor="line-indirect">Indirect %</Label>
          <Input
            id="line-indirect"
            type="number"
            step="0.1"
            min={0}
            max={100}
            {...register('indirectCostPct')}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Add line
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  )
}
