'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createInventoryItemSchema,
  type CreateInventoryItemInput,
} from '@repo/validators'
import {
  createInventoryItem,
  updateInventoryItem,
  createInventoryCategory,
  createInventorySubcategory,
} from '@/app/actions/inventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { InventoryItemFormDto } from '@/lib/types/inventory-dto'

type CategoryOption = { id: string; name: string; sortOrder: number }
type SubcategoryOption = { id: string; categoryId: string; name: string; sortOrder: number }

interface ItemFormProps {
  item?: InventoryItemFormDto
  categories: CategoryOption[]
  subcategories: SubcategoryOption[]
}

const UNITS = [
  { value: 'un', label: 'Unidad (un)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'm2', label: 'Metro Cuadrado (m²)' },
  { value: 'm3', label: 'Metro Cúbico (m³)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'caja', label: 'Caja' },
  { value: 'ton', label: 'Tonelada (ton)' },
]

function toNum(v: unknown): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number') return v
  const n = (v as { toNumber?: () => number })?.toNumber?.()
  return n != null ? n : undefined
}

export function ItemForm({ item, categories, subcategories }: ItemFormProps) {
  const t = useTranslations('inventory')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [addingSubcategory, setAddingSubcategory] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateInventoryItemInput>({
    resolver: zodResolver(createInventoryItemSchema),
    defaultValues: item
      ? {
          sku: item.sku,
          name: item.name,
          description: item.description ?? '',
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId ?? undefined,
          unit: item.unit,
          minStockQty: toNum(item.minStockQty),
          reorderQty: toNum(item.reorderQty),
        }
      : {
          categoryId: categories[0]?.id ?? '',
          unit: 'un',
        },
  })

  const selectedCategoryId = watch('categoryId')
  const subcategoriesForCategory = subcategories.filter((s) => s.categoryId === selectedCategoryId)

  async function onSubmit(data: CreateInventoryItemInput) {
    setIsSubmitting(true)
    try {
      const result = item
        ? await updateInventoryItem(item.id, data)
        : await createInventoryItem(data)

      if (result.success) {
        toast.success(item ? t('success.itemUpdated') : t('success.itemCreated'))
        router.push('/inventory/items')
        router.refresh()
      } else {
        toast.error(result.error ?? t('toast.itemSaveError'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    setAddingCategory(true)
    try {
      const res = await createInventoryCategory(name)
      if (res.success) {
        toast.success(t('toast.categoryAdded'))
        setNewCategoryName('')
        setAddingCategory(false)
        router.refresh()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.categoryAddError'))
    } finally {
      setAddingCategory(false)
    }
  }

  async function handleAddSubcategory() {
    const name = newSubcategoryName.trim()
    if (!name || !selectedCategoryId) return
    setAddingSubcategory(true)
    try {
      const res = await createInventorySubcategory(selectedCategoryId, name)
      if (res.success) {
        toast.success(t('toast.subcategoryAdded'))
        setNewSubcategoryName('')
        setAddingSubcategory(false)
        router.refresh()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.subcategoryAddError'))
    } finally {
      setAddingSubcategory(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit as (data: CreateInventoryItemInput) => Promise<void>)} className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Información Básica</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              placeholder="MAT-001"
              {...register('sku')}
              className="mt-1 font-mono"
            />
            {errors.sku && (
              <p className="mt-1 text-xs text-destructive">{errors.sku.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Código único del item
            </p>
          </div>

          <div>
            <Label htmlFor="categoryId">Categoría *</Label>
            <select
              id="categoryId"
              {...register('categoryId', {
                onChange: () => {
                  setValue('subcategoryId', '')
                },
              })}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccionar categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="mt-1 text-xs text-destructive">
                {errors.categoryId.message}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Nueva categoría..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="h-9 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddCategory} disabled={!newCategoryName.trim() || addingCategory}>
                {addingCategory ? '...' : 'Agregar'}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="subcategoryId">Subcategoría</Label>
            <select
              id="subcategoryId"
              {...register('subcategoryId')}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            >
              <option value="">Ninguna</option>
              {subcategoriesForCategory.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {selectedCategoryId && (
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Nueva subcategoría..."
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  className="h-9 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubcategory())}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddSubcategory} disabled={!newSubcategoryName.trim() || addingSubcategory}>
                  {addingSubcategory ? '...' : 'Agregar'}
                </Button>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              placeholder="Cemento Portland Tipo I - 50kg"
              {...register('name')}
              className="mt-1"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Descripción detallada del item..."
              {...register('description')}
              rows={3}
              className="mt-1"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Unidad y Stock</h3>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="unit">Unidad de Medida *</Label>
            <select
              id="unit"
              {...register('unit')}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
            {errors.unit && (
              <p className="mt-1 text-xs text-destructive">
                {errors.unit.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="minStockQty">Stock Mínimo</Label>
            <Input
              id="minStockQty"
              type="number"
              step="0.01"
              placeholder="10.00"
              {...register('minStockQty', { valueAsNumber: true })}
              className="mt-1"
            />
            {errors.minStockQty && (
              <p className="mt-1 text-xs text-destructive">
                {errors.minStockQty.message}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Alerta cuando stock baje de este valor
            </p>
          </div>

          <div>
            <Label htmlFor="reorderQty">Cantidad de Reposición</Label>
            <Input
              id="reorderQty"
              type="number"
              step="0.01"
              placeholder="50.00"
              {...register('reorderQty', { valueAsNumber: true })}
              className="mt-1"
            />
            {errors.reorderQty && (
              <p className="mt-1 text-xs text-destructive">
                {errors.reorderQty.message}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Cantidad sugerida para comprar
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="default" disabled={isSubmitting}>
          {isSubmitting
            ? 'Guardando...'
            : item
              ? 'Actualizar Item'
              : 'Crear Item'}
        </Button>
      </div>
    </form>
  )
}
