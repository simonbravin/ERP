'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createInventoryMovement, getItemStockByLocation } from '@/app/actions/inventory'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

const adjustmentSchema = z.object({
  itemId: z.string().min(1, 'Selecciona un item'),
  locationId: z.string().min(1, 'Selecciona ubicación'),
  quantity: z.coerce.number().refine((v) => v !== 0, 'La cantidad no puede ser 0'),
  notes: z.string().min(1, 'La razón del ajuste es obligatoria'),
})

type AdjustmentInput = z.infer<typeof adjustmentSchema>

function idempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

interface AdjustmentFormProps {
  items: Array<{ id: string; sku: string; name: string; unit: string }>
  locations: Array<{ id: string; name: string }>
  initialItemId?: string
}

export function AdjustmentForm({
  items,
  locations,
  initialItemId,
}: AdjustmentFormProps) {
  const t = useTranslations('inventory')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItem, setSelectedItem] = useState<
    { id: string; sku: string; name: string; unit: string } | undefined
  >(items.find((i) => i.id === initialItemId))
  const [currentStock, setCurrentStock] = useState(0)
  const [isLoadingStock, setIsLoadingStock] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AdjustmentInput>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      itemId: initialItemId ?? '',
      locationId: '',
      quantity: 0,
      notes: '',
    },
  })

  const itemId = watch('itemId')
  const locationId = watch('locationId')
  const quantity = watch('quantity')

  useEffect(() => {
    if (itemId && locationId) {
      setIsLoadingStock(true)
      getItemStockByLocation(itemId, locationId)
        .then((result) => {
          if (result.success) setCurrentStock(result.stock ?? 0)
          else setCurrentStock(0)
        })
        .finally(() => setIsLoadingStock(false))
    } else {
      setCurrentStock(0)
    }
  }, [itemId, locationId])

  const qty = quantity ?? 0
  const newStock = currentStock + qty
  const isNegative = qty < 0
  const hasInvalidNegative = isNegative && Math.abs(qty) > currentStock

  async function onSubmit(data: AdjustmentInput) {
    if (isNegative && Math.abs(data.quantity) > currentStock) {
      toast.error(
        t('toast.adjustmentExceedsStock', {
          stock: currentStock.toFixed(2),
          unit: selectedItem?.unit ?? '',
        })
      )
      return
    }
    setIsSubmitting(true)
    try {
      const isAdd = data.quantity > 0
      const result = await createInventoryMovement({
        movementType: 'ADJUSTMENT',
        itemId: data.itemId,
        fromLocationId: isAdd ? null : data.locationId,
        toLocationId: isAdd ? data.locationId : null,
        quantity: Math.abs(data.quantity),
        unitCost: 0,
        notes: data.notes,
        idempotencyKey: idempotencyKey(`adjust_${data.itemId}`),
      })

      if (result.success) {
        toast.success(t('toast.adjustmentOk'))
        router.push('/inventory/movements')
        router.refresh()
      } else {
        toast.error(t('toast.adjustmentError'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Ajuste de Inventario</h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="itemId">Item *</Label>
            <select
              id="itemId"
              {...register('itemId')}
              onChange={(e) => {
                const item = items.find((i) => i.id === e.target.value)
                setSelectedItem(item)
              }}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccionar item...</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} - {item.name}
                </option>
              ))}
            </select>
            {errors.itemId && (
              <p className="mt-1 text-xs text-destructive">{errors.itemId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="locationId">Ubicación *</Label>
            <select
              id="locationId"
              {...register('locationId')}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccionar ubicación...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            {errors.locationId && (
              <p className="mt-1 text-xs text-destructive">{errors.locationId.message}</p>
            )}
          </div>

          {locationId && itemId && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Stock actual en sistema:
                </span>
                <span className="font-mono text-lg font-bold tabular-nums">
                  {isLoadingStock
                    ? '...'
                    : `${currentStock.toFixed(2)} ${selectedItem?.unit ?? ''}`}
                </span>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="quantity">
              Ajuste de cantidad (+ agregar, - quitar) *
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              placeholder="5.00 o -3.00"
              {...register('quantity', { valueAsNumber: true })}
              className="mt-1"
            />
            {errors.quantity && (
              <p className="mt-1 text-xs text-destructive">{errors.quantity.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Positivo para aumentar stock, negativo para disminuir
            </p>
            {hasInvalidNegative && (
              <p className="mt-1 text-xs text-destructive">
                No se puede quitar más de {currentStock.toFixed(2)} {selectedItem?.unit ?? ''}
              </p>
            )}
          </div>

          {qty !== 0 && qty !== undefined && !hasInvalidNegative && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nuevo stock:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {newStock.toFixed(2)} {selectedItem?.unit ?? ''}
                  </span>
                  <Badge variant={qty > 0 ? 'success' : 'warning'}>
                    {qty > 0 ? '+' : ''}{qty.toFixed(2)}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Razón del ajuste *</Label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={3}
              placeholder="Ej: Inventario físico - diferencia detectada, Material dañado, Error de registro..."
              className="mt-1 flex w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            />
            {errors.notes && (
              <p className="mt-1 text-xs text-destructive">{errors.notes.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Obligatorio para auditoría
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={isSubmitting || hasInvalidNegative || qty === 0}
        >
          {isSubmitting ? 'Registrando...' : 'Registrar Ajuste'}
        </Button>
      </div>
    </form>
  )
}
