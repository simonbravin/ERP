'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createWBSItemSchema,
  type CreateWBSItemInput,
  type UpdateWBSItemInput,
  WBS_TYPE,
} from '@repo/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type WbsNodeOption = { id: string; code: string; name: string; category: string }

type WbsFormDialogProps = {
  open: boolean
  onClose: () => void
  projectId: string
  mode: 'create' | 'edit'
  parentOptions: WbsNodeOption[]
  defaultParentId: string | null
  defaultValues?: Partial<UpdateWBSItemInput>
  nodeId?: string
  onSubmit: (
    projectId: string,
    data: CreateWBSItemInput | UpdateWBSItemInput,
    nodeId?: string
  ) => Promise<{ error?: Record<string, string[]> } | { success: boolean }>
}

export function WbsFormDialog({
  open,
  onClose,
  projectId,
  mode,
  parentOptions,
  defaultParentId,
  defaultValues,
  nodeId,
  onSubmit,
}: WbsFormDialogProps) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWBSItemInput>({
    resolver: zodResolver(createWBSItemSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      type: (defaultValues?.type ?? 'PHASE') as 'PHASE' | 'ACTIVITY' | 'TASK',
      parentId: defaultValues?.parentId ?? defaultParentId ?? undefined,
      estimatedDuration: defaultValues?.estimatedDuration ?? undefined,
      unit: defaultValues?.unit ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: defaultValues?.name ?? '',
        description: defaultValues?.description ?? '',
        type: (defaultValues?.type ?? 'PHASE') as 'PHASE' | 'ACTIVITY' | 'TASK',
        parentId: defaultValues?.parentId ?? defaultParentId ?? undefined,
        estimatedDuration: defaultValues?.estimatedDuration ?? undefined,
        unit: defaultValues?.unit ?? '',
      })
    }
  }, [open, defaultValues, defaultParentId, reset])

  if (!open) return null

  async function handleFormSubmit(data: CreateWBSItemInput) {
    const result = await onSubmit(projectId, data, nodeId)
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      const err = result.error as Record<string, string[]>
      if (err._form) setError('root', { message: err._form[0] })
      Object.entries(err).forEach(([field, messages]) => {
        if (field !== '_form' && messages?.[0]) setError(field as keyof CreateWBSItemInput, { message: messages[0] })
      })
      return
    }
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div
        className="relative z-10 erp-form-modal rounded-lg border border-border bg-card p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wbs-dialog-title"
      >
        <h2 id="wbs-dialog-title" className="text-lg font-semibold text-foreground">
          {mode === 'create' ? 'Add WBS Item' : 'Edit WBS Item'}
        </h2>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="wbs-name">Name</Label>
            <Input id="wbs-name" {...register('name')} className="mt-1 w-full" />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="wbs-description">Description</Label>
            <textarea
              id="wbs-description"
              {...register('description')}
              rows={2}
              className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <Label htmlFor="wbs-type">Type</Label>
            <select
              id="wbs-type"
              {...register('type')}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              {WBS_TYPE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="wbs-parent">Parent</Label>
            <select
              id="wbs-parent"
              {...register('parentId')}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="">— Root —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} {p.name}
                </option>
              ))}
            </select>
            {errors.parentId && (
              <p className="mt-1 text-sm text-destructive">{errors.parentId.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wbs-duration">Estimated duration</Label>
              <Input
                id="wbs-duration"
                type="number"
                min={0}
                step={0.5}
                {...register('estimatedDuration')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="wbs-unit">Unit</Label>
              <Input id="wbs-unit" {...register('unit')} placeholder="e.g. days" className="mt-1" />
            </div>
          </div>
          {errors.root && (
            <p className="text-sm text-destructive">{errors.root.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {mode === 'create' ? 'Add' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
