'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createChangeOrderLineSchema,
  type CreateChangeOrderLineInput,
} from '@repo/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type WbsOption = { id: string; code: string; name: string }

type COLineFormProps = {
  coId: string
  wbsOptions: WbsOption[]
  onSubmit: (data: CreateChangeOrderLineInput) => Promise<{ error?: Record<string, string[]> } | { success: boolean }>
}

export function COLineForm({ coId: _coId, wbsOptions, onSubmit }: COLineFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateChangeOrderLineInput>({
    resolver: zodResolver(createChangeOrderLineSchema),
    defaultValues: {
      wbsNodeId: '',
      changeType: 'ADD',
      justification: '',
      deltaCost: 0,
    },
  })

  async function handleFormSubmit(data: CreateChangeOrderLineInput) {
    const result = await onSubmit(data)
    if (result && 'error' in result && result.error) {
      Object.entries(result.error).forEach(([field, messages]) => {
        if (messages?.[0]) setError(field as keyof CreateChangeOrderLineInput, { message: messages[0] })
      })
      return
    }
    reset({ wbsNodeId: '', justification: '', deltaCost: 0 })
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
    >
      <div className="min-w-[140px]">
        <Label htmlFor="col-wbs">WBS</Label>
        <select
          id="col-wbs"
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
      <div className="min-w-[280px] flex-1">
        <Label htmlFor="col-justification">Justification</Label>
        <Input id="col-justification" {...register('justification')} className="mt-1" placeholder="Description of change" />
        {errors.justification && (
          <p className="mt-1 text-xs text-destructive">{errors.justification.message}</p>
        )}
      </div>
      <div className="w-28">
        <Label htmlFor="col-delta">Delta cost ($)</Label>
        <Input
          id="col-delta"
          type="number"
          step="0.01"
          {...register('deltaCost')}
          className="mt-1"
        />
        {errors.deltaCost && (
          <p className="mt-1 text-xs text-destructive">{errors.deltaCost.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Add line
      </Button>
    </form>
  )
}
