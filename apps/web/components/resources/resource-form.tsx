'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createResourceSchema,
  updateResourceSchema,
  RESOURCE_CATEGORY,
  type CreateResourceInput,
  type UpdateResourceInput,
} from '@repo/validators'
import { getDefaultUnitForCategory } from '@/lib/resource-utils'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SupplierOption = { id: string; name: string }

type ResourceFormProps = {
  mode: 'create' | 'edit'
  defaultValues?: Partial<UpdateResourceInput>
  supplierOptions: SupplierOption[]
  onSubmit: (data: CreateResourceInput | UpdateResourceInput) => Promise<{ error?: Record<string, string[]> } | { success: boolean }>
  onCancelHref: string
}

export function ResourceForm({
  mode,
  defaultValues,
  supplierOptions,
  onSubmit,
  onCancelHref,
}: ResourceFormProps) {
  const isCreate = mode === 'create'
  const schema = isCreate ? createResourceSchema : updateResourceSchema
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateResourceInput | UpdateResourceInput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      code: '',
      name: '',
      category: 'MATERIAL',
      description: '',
      unit: 'ea',
      unitCost: 0,
      supplierId: '',
    },
  })

  const category = watch('category')
  useEffect(() => {
    if (category) setValue('unit', getDefaultUnitForCategory(category))
  }, [category, setValue])

  const router = useRouter()

  async function handleFormSubmit(data: CreateResourceInput | UpdateResourceInput) {
    const cleanedData = {
      ...data,
      code: data.code?.trim() || undefined,
      supplierId: data.supplierId === '' || !data.supplierId ? null : data.supplierId,
      description: data.description?.trim() || undefined,
    } as CreateResourceInput | UpdateResourceInput
    const result = await onSubmit(cleanedData)
    if (result && 'error' in result && result.error) {
      if (result.error._form) setError('root', { message: result.error._form[0] })
      Object.entries(result.error).forEach(([field, messages]) => {
        if (field !== '_form' && messages?.[0])
          setError(field as keyof CreateResourceInput, { message: messages[0] })
      })
      return
    }
    if (result && 'success' in result) {
      router.push(onCancelHref)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="erp-form-page space-y-4">
      {isCreate && (
        <div>
          <Label htmlFor="code">Code (leave blank to auto-generate)</Label>
          <Input
            id="code"
            {...register('code', { required: false })}
            className="mt-1"
            placeholder="Leave blank to auto-generate"
          />
          {errors.code && (
            <p className="mt-1 text-sm text-destructive">{errors.code.message}</p>
          )}
        </div>
      )}
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} className="mt-1" />
        {errors.name && (
          <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          {...register('category')}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        >
          {RESOURCE_CATEGORY.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          {...register('description')}
          rows={2}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" {...register('unit')} className="mt-1" placeholder="ea, hr, day" />
          {errors.unit && (
            <p className="mt-1 text-sm text-destructive">{errors.unit.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="unitCost">Unit cost</Label>
          <Controller
            name="unitCost"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                id="unitCost"
                value={field.value ?? null}
                onChange={field.onChange}
                className="mt-1"
              />
            )}
          />
          {errors.unitCost && (
            <p className="mt-1 text-sm text-destructive">{errors.unitCost.message}</p>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="supplierId">
          Supplier <span className="text-gray-400">(optional)</span>
        </Label>
        <select
          id="supplierId"
          {...register('supplierId')}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        >
          <option value="">— No supplier —</option>
          {supplierOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {errors.supplierId && (
          <p className="mt-1 text-sm text-destructive">{errors.supplierId.message}</p>
        )}
      </div>
      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isCreate ? 'Create resource' : 'Save'}
        </Button>
        <a href={onCancelHref}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </a>
      </div>
    </form>
  )
}
