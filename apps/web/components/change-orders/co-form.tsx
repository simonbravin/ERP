'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createChangeOrderSchema,
  updateChangeOrderSchema,
  changeOrderFormSchema,
  CHANGE_ORDER_LINE_TYPE,
  BUDGET_IMPACT_TYPE,
} from '@repo/validators'
import type {
  CreateChangeOrderInput,
  UpdateChangeOrderInput,
  ChangeOrderFormInput,
} from '@repo/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { updateChangeOrderWithLines, type ChangeOrderLineInput } from '@/app/actions/change-orders'
import { useRouter } from 'next/navigation'

export type WbsNodeOption = { id: string; code: string; name: string }

type COFormProps = {
  mode: 'create' | 'edit'
  projectId: string
  defaultValues?: Partial<ChangeOrderFormInput>
  wbsOptions: WbsNodeOption[]
  /** For create: submit handler with form data */
  onSubmit?: (data: CreateChangeOrderInput) => Promise<{ error?: Record<string, string[]> } | { success: boolean; changeOrderId?: string }>
  coId?: string
  onCancelHref: string
  /** Optional extra class for the form container (e.g. w-full for wider layout) */
  formClassName?: string
}

function toDateInputValue(d: Date | undefined | null): string {
  if (!d) return ''
  const x = d instanceof Date ? d : new Date(d)
  return x.toISOString().slice(0, 10)
}

export function COForm({
  mode,
  projectId,
  defaultValues,
  wbsOptions,
  onSubmit,
  coId,
  onCancelHref,
  formClassName,
}: COFormProps) {
  const t = useTranslations('changeOrders')
  const router = useRouter()
  const isCreate = mode === 'create'

  const schema = isCreate ? createChangeOrderSchema : changeOrderFormSchema
  const {
    register,
    control,
    watch,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangeOrderFormInput | CreateChangeOrderInput>({
    resolver: zodResolver(schema),
    defaultValues: (defaultValues as ChangeOrderFormInput) ?? {
      title: '',
      reason: '',
      justification: '',
      changeType: 'SCOPE',
      budgetImpactType: 'DEVIATION',
      costImpact: 0,
      timeImpactDays: 0,
      requestDate: undefined,
      implementedDate: undefined,
      lines: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines' as keyof ChangeOrderFormInput,
  })

  const lines = watch('lines' as keyof ChangeOrderFormInput) as ChangeOrderFormInput['lines'] | undefined
  const costImpact = watch('costImpact' as keyof ChangeOrderFormInput)
  const linesSum =
    (Array.isArray(lines) ? lines : []).reduce((acc, row) => acc + (Number(row?.deltaCost) || 0), 0)
  const costMismatch = Array.isArray(lines) && lines.length > 0 && Math.abs(Number(costImpact) - linesSum) > 0.01

  async function handleFormSubmit(data: ChangeOrderFormInput | CreateChangeOrderInput) {
    if (isCreate && onSubmit) {
      const createData: CreateChangeOrderInput = {
        title: data.title,
        reason: data.reason,
        justification: data.justification ?? undefined,
        changeType: data.changeType ?? 'SCOPE',
        budgetImpactType: (data as ChangeOrderFormInput).budgetImpactType ?? 'DEVIATION',
        costImpact: Number(data.costImpact ?? 0),
        timeImpactDays: Number(data.timeImpactDays ?? 0),
        requestDate: data.requestDate ?? undefined,
        implementedDate: (data as ChangeOrderFormInput).implementedDate ?? undefined,
      }
      const result = await onSubmit(createData)
      if (result && 'error' in result && result.error) {
        if (result.error._form) setError('root', { message: result.error._form[0] })
        Object.entries(result.error).forEach(([field, messages]) => {
          if (field !== '_form' && messages?.[0])
            setError(field as keyof CreateChangeOrderInput, { message: messages[0] })
        })
      }
      return
    }

    if (!isCreate && coId) {
      const formData = data as ChangeOrderFormInput
      const header: UpdateChangeOrderInput = {
        title: formData.title,
        reason: formData.reason,
        justification: formData.justification ?? undefined,
        changeType: formData.changeType,
        budgetImpactType: formData.budgetImpactType,
        costImpact: formData.lines?.length
          ? formData.lines.reduce((a, l) => a + (Number(l.deltaCost) || 0), 0)
          : Number(formData.costImpact ?? 0),
        timeImpactDays: Number(formData.timeImpactDays ?? 0),
        requestDate: formData.requestDate ?? undefined,
        implementedDate: formData.implementedDate ?? undefined,
      }
      const linePayload: ChangeOrderLineInput[] = (formData.lines ?? []).map((l) => ({
        wbsNodeId: l.wbsNodeId,
        changeType: l.changeType,
        justification: l.justification,
        deltaCost: Number(l.deltaCost) || 0,
      }))
      const result = await updateChangeOrderWithLines(coId, header, linePayload)
      if (result && 'error' in result && result.error) {
        if (result.error._form) setError('root', { message: result.error._form[0] })
        Object.entries(result.error).forEach(([field, messages]) => {
          if (field !== '_form' && messages?.[0])
            setError(field as keyof UpdateChangeOrderInput, { message: messages[0] } as any)
        })
      } else if (result && 'success' in result) {
        router.refresh()
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit as any)}
      className={`erp-form-page w-full max-w-4xl space-y-6 rounded-lg border border-border bg-card p-6 ${formClassName ?? ''}`.trim()}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="co-title">{t('title_field')} *</Label>
          <Input id="co-title" {...register('title')} className="mt-1 border-input bg-background" />
          {errors.title && (
            <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="co-changeType">{t('changeType')}</Label>
            <Select
              value={watch('changeType') ?? 'SCOPE'}
              onValueChange={(v) => setValue('changeType', v)}
            >
              <SelectTrigger id="co-changeType" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SCOPE">{t('changeTypeScope')}</SelectItem>
                <SelectItem value="TIME">{t('changeTypeTime')}</SelectItem>
                <SelectItem value="COST">{t('changeTypeCost')}</SelectItem>
                <SelectItem value="OTHER">{t('changeTypeOther')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isCreate && (
            <div>
              <Label>{t('budgetImpactType')}</Label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="DEVIATION"
                    {...register('budgetImpactType' as any)}
                    className="border-input"
                  />
                  <span className="text-sm">{t('budgetImpactDeviation')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="APPROVED_CHANGE"
                    {...register('budgetImpactType' as any)}
                    className="border-input"
                  />
                  <span className="text-sm">{t('budgetImpactApproved')}</span>
                </label>
              </div>
            </div>
          )}
          {isCreate && (
            <div>
              <Label>{t('budgetImpactType')}</Label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="DEVIATION"
                    {...register('budgetImpactType' as any)}
                    className="border-input"
                  />
                  <span className="text-sm">{t('budgetImpactDeviation')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="APPROVED_CHANGE"
                    {...register('budgetImpactType' as any)}
                    className="border-input"
                  />
                  <span className="text-sm">{t('budgetImpactApproved')}</span>
                </label>
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="co-costImpact">{t('costImpact')}</Label>
            <div className="mt-1 flex items-center rounded-md border border-input bg-background">
              <span className="pl-3 text-sm text-muted-foreground">$</span>
              <Input
                id="co-costImpact"
                type="number"
                step="0.01"
                min={0}
                {...register('costImpact', { valueAsNumber: true })}
                className="border-0 bg-transparent pl-1 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            {errors.costImpact && (
              <p className="mt-1 text-sm text-destructive">{errors.costImpact.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="co-timeImpactDays">{t('timeImpactDays')}</Label>
            <Input
              id="co-timeImpactDays"
              type="number"
              min={0}
              {...register('timeImpactDays', { valueAsNumber: true })}
              className="mt-1 border-input bg-background"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="co-requestDate">{t('requestDate')}</Label>
            <Input
              id="co-requestDate"
              type="date"
              {...register('requestDate')}
              value={toDateInputValue(watch('requestDate' as any))}
              onChange={(e) => setValue('requestDate' as any, e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined)}
              className="mt-1 border-input bg-background"
            />
          </div>
          <div>
            <Label htmlFor="co-implementedDate">{t('implementedDate')}</Label>
            <Input
              id="co-implementedDate"
              type="date"
              {...register('implementedDate')}
              value={toDateInputValue(watch('implementedDate' as any))}
              onChange={(e) => setValue('implementedDate' as any, e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined)}
              className="mt-1 border-input bg-background"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="co-reason">{t('reason')} *</Label>
          <Textarea
            id="co-reason"
            {...register('reason')}
            rows={3}
            className="mt-1 border-input bg-background text-foreground"
          />
          {errors.reason && (
            <p className="mt-1 text-sm text-destructive">{errors.reason.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="co-justification">{t('justification')}</Label>
          <Textarea
            id="co-justification"
            {...register('justification')}
            rows={2}
            className="mt-1 border-input bg-background text-foreground"
          />
        </div>
      </div>

      {!isCreate && (
        <>
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{t('detailByWbs')}</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    wbsNodeId: wbsOptions[0]?.id ?? '',
                    changeType: 'ADD',
                    justification: '',
                    deltaCost: 0,
                  })
                }
                disabled={wbsOptions.length === 0}
              >
                {t('addLine')}
              </Button>
            </div>
            {fields.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('wbsNode')}</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('lineChangeType')}</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('justification')}</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('deltaCost')}</th>
                      <th className="w-12 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => (
                      <tr key={field.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <Select
                            value={watch(`lines.${idx}.wbsNodeId`)}
                            onValueChange={(v) => setValue(`lines.${idx}.wbsNodeId`, v)}
                          >
                            <SelectTrigger className="h-9 border-input bg-background">
                              <SelectValue placeholder={t('wbsNode')} />
                            </SelectTrigger>
                            <SelectContent>
                              {wbsOptions.map((n) => (
                                <SelectItem key={n.id} value={n.id}>
                                  {n.code} {n.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={watch(`lines.${idx}.changeType`)}
                            onValueChange={(v: 'ADD' | 'MODIFY' | 'DELETE') =>
                              setValue(`lines.${idx}.changeType`, v)
                            }
                          >
                            <SelectTrigger className="h-9 border-input bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHANGE_ORDER_LINE_TYPE.map((tipo) => (
                                <SelectItem key={tipo} value={tipo}>
                                  {tipo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            {...register(`lines.${idx}.justification`)}
                            className="h-9 border-input bg-background"
                            placeholder={t('justification')}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1 rounded-md border border-input bg-background">
                            <span className="pl-2 text-xs text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`lines.${idx}.deltaCost`, { valueAsNumber: true })}
                              className="h-9 w-24 border-0 bg-transparent pl-0 pr-2 text-right focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => remove(idx)}
                          >
                            {t('removeLine')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {fields.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('totalFromLines')}: {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(linesSum)}
              </p>
            )}
            {costMismatch && (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                {t('costMismatchWarning')}
              </p>
            )}
          </div>
        </>
      )}

      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isCreate ? t('create') : t('save')}
        </Button>
        <Link href={onCancelHref}>
          <Button type="button" variant="outline">
            {t('cancel')}
          </Button>
        </Link>
      </div>
    </form>
  )
}
