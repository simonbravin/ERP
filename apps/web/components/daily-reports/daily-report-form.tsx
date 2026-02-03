'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  createDailyReportSchema,
  updateDailyReportSchema,
  WEATHER_CONDITION,
  type CreateDailyReportInput,
  type UpdateDailyReportInput,
  type LaborEntryInput,
} from '@repo/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LaborEntriesTable } from './labor-entries-table'

type WbsOption = { id: string; code: string; name: string }

type DailyReportFormProps = {
  mode: 'create' | 'edit'
  projectId: string
  defaultValues?: Partial<UpdateDailyReportInput> & { laborEntries?: LaborEntryInput[] }
  wbsOptions?: WbsOption[]
  onSubmitCreate?: (data: CreateDailyReportInput, action: 'draft' | 'submit') => Promise<void>
  onSubmitEdit?: (data: UpdateDailyReportInput, action: 'draft' | 'submit') => Promise<void>
  onCancelHref: string
  isSubmitting?: boolean
}

const weatherLabels: Record<string, string> = {
  SUNNY: 'Soleado',
  CLOUDY: 'Nublado',
  RAINY: 'Lluvia',
  SNOWY: 'Nieve',
  WINDY: 'Viento',
}

export function DailyReportForm({
  mode,
  projectId,
  defaultValues,
  wbsOptions = [],
  onSubmitCreate,
  onSubmitEdit,
  onCancelHref,
  isSubmitting = false,
}: DailyReportFormProps) {
  const isCreate = mode === 'create'
  const schema = isCreate ? createDailyReportSchema : updateDailyReportSchema
  const {
    register,
    control,
    handleSubmit: _handleSubmit,
    trigger,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateDailyReportInput | UpdateDailyReportInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      reportDate: defaultValues?.reportDate ?? new Date(),
      summary: defaultValues?.summary ?? '',
      workAccomplished: defaultValues?.workAccomplished ?? '',
      weather: defaultValues?.weather ?? null,
      observations: defaultValues?.observations ?? null,
      laborEntries: defaultValues?.laborEntries ?? [],
      wbsNodeId: defaultValues?.wbsNodeId ?? null,
      wbsNodeIds: defaultValues?.wbsNodeIds ?? [],
    },
  })

  const laborEntries = watch('laborEntries') as LaborEntryInput[] | undefined
  const setLaborEntries = (entries: LaborEntryInput[]) => setValue('laborEntries', entries)

  async function submitWithAction(action: 'draft' | 'submit') {
    const data = getValues()
    const wbsIds = Array.isArray(data.wbsNodeIds) ? (data.wbsNodeIds as string[]).filter(Boolean) : []
    const payload = {
      ...data,
      wbsNodeId: data.wbsNodeId === '__none__' || data.wbsNodeId === '' ? null : data.wbsNodeId,
      wbsNodeIds: wbsIds,
    }
    if (action === 'draft') {
      if ((payload.summary?.trim() ?? '').length < 5) (payload as { summary: string }).summary = 'Borrador'
    }
    if (action === 'submit') {
      const valid = await trigger(undefined, { shouldFocus: true })
      if (!valid) {
        toast.error(
          errors.summary?.message ??
            errors.reportDate?.message ??
            'Revisá que el resumen tenga al menos 5 caracteres y que la fecha sea válida.'
        )
        return
      }
    } else {
      await trigger()
    }
    if (isCreate && onSubmitCreate)
      await onSubmitCreate({ ...payload, projectId } as CreateDailyReportInput, action)
    else if (!isCreate && onSubmitEdit) await onSubmitEdit(payload as UpdateDailyReportInput, action)
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="w-full max-w-5xl space-y-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reportDate">Fecha</Label>
            <Input
              id="reportDate"
              type="date"
              {...register('reportDate', { valueAsDate: true })}
              className="h-10 w-full"
            />
            {errors.reportDate && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.reportDate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="weather">Condiciones climáticas</Label>
            <select
              id="weather"
              {...register('weather')}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="">— Ninguna —</option>
              {WEATHER_CONDITION.map((w) => (
                <option key={w} value={w}>
                  {weatherLabels[w] ?? w}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="summary">Resumen (máx. 200 caracteres)</Label>
          <Input
            id="summary"
            {...register('summary')}
            maxLength={200}
            placeholder="Breve resumen del día"
            className="h-10 w-full"
          />
          {errors.summary && (
            <p className="text-sm text-red-600 dark:text-red-400">{errors.summary.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="workAccomplished">Descripción de trabajos</Label>
          <textarea
            id="workAccomplished"
            {...register('workAccomplished')}
            rows={5}
            placeholder="Qué se trabajó, qué avances hubo..."
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          {errors.workAccomplished && (
            <p className="text-sm text-red-600 dark:text-red-400">{errors.workAccomplished.message}</p>
          )}
        </div>

        <LaborEntriesTable
          value={laborEntries ?? []}
          onChange={(entries) => setValue('laborEntries', entries)}
          disabled={false}
        />

        <div className="space-y-2">
          <Label htmlFor="observations">Observaciones / Problemas</Label>
          <textarea
            id="observations"
            {...register('observations')}
            rows={3}
            placeholder="Qué salió mal, cambios inesperados..."
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>

        {wbsOptions.length > 0 && (
          <div className="space-y-2">
            <Label>WBS — partidas en las que se trabajó (opcional, varias)</Label>
            <Controller
              name="wbsNodeIds"
              control={control}
              render={({ field }) => (
                <div className="max-h-[min(16rem,50vh)] space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3 dark:border-gray-700">
                  {wbsOptions.map((w) => {
                    const selected = Array.isArray(field.value) ? field.value.includes(w.id) : false
                    return (
                      <label
                        key={w.id}
                        className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const next = selected
                              ? (field.value as string[]).filter((id) => id !== w.id)
                              : [...(field.value as string[]), w.id]
                            field.onChange(next)
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{w.code}</span>
                        <span className="text-sm text-gray-900 dark:text-white">{w.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            />
          </div>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.root.message}</p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={() => submitWithAction('draft')}
        >
          {isSubmitting ? 'Guardando…' : 'Guardar como borrador'}
        </Button>
        <Button
          type="button"
          variant="default"
          disabled={isSubmitting}
          onClick={() => submitWithAction('submit')}
        >
          {isSubmitting ? 'Enviando…' : 'Enviar'}
        </Button>
        <Link href={onCancelHref}>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  )
}
