'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createInventoryMovement, getItemStockByLocation } from '@/app/actions/inventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

const transferSchema = z
  .object({
    itemId: z.string().min(1, 'Selecciona un item'),
    fromLocationId: z.string().min(1, 'Selecciona ubicación origen'),
    toLocationId: z.string().min(1, 'Selecciona ubicación destino'),
    quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
    notes: z.string().optional(),
  })
  .refine((data) => data.fromLocationId !== data.toLocationId, {
    message: 'La ubicación origen y destino deben ser diferentes',
    path: ['toLocationId'],
  })

type TransferInput = z.infer<typeof transferSchema>

function idempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

interface TransferFormProps {
  items: Array<{ id: string; sku: string; name: string; unit: string }>
  locations: Array<{ id: string; name: string }>
  initialItemId?: string
}

export function TransferForm({
  items,
  locations,
  initialItemId,
}: TransferFormProps) {
  const t = useTranslations('inventory')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItem, setSelectedItem] = useState<
    { id: string; sku: string; name: string; unit: string } | undefined
  >(items.find((i) => i.id === initialItemId))
  const [availableStock, setAvailableStock] = useState<number>(0)
  const [isLoadingStock, setIsLoadingStock] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TransferInput>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      itemId: initialItemId ?? '',
      fromLocationId: '',
      toLocationId: '',
      quantity: 1,
    },
  })

  const itemId = watch('itemId')
  const fromLocationId = watch('fromLocationId')
  const quantity = watch('quantity')

  useEffect(() => {
    if (itemId && fromLocationId) {
      setIsLoadingStock(true)
      getItemStockByLocation(itemId, fromLocationId)
        .then((result) => {
          if (result.success) {
            setAvailableStock(result.stock ?? 0)
          } else {
            setAvailableStock(0)
          }
        })
        .finally(() => setIsLoadingStock(false))
    } else {
      setAvailableStock(0)
    }
  }, [itemId, fromLocationId])

  async function onSubmit(data: TransferInput) {
    if (data.quantity > availableStock) {
      toast.error(
        `Stock insuficiente. Disponible: ${availableStock.toFixed(2)} ${selectedItem?.unit ?? ''}`
      )
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createInventoryMovement({
        movementType: 'TRANSFER',
        itemId: data.itemId,
        fromLocationId: data.fromLocationId,
        toLocationId: data.toLocationId,
        quantity: data.quantity,
        unitCost: 0,
        notes: data.notes,
        idempotencyKey: idempotencyKey(`transfer_${data.itemId}`),
      })

      if (result.success) {
        toast.success(t('toast.transferOk'))
        router.push('/inventory/movements')
        router.refresh()
      } else {
        toast.error(t('toast.transferError'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasInsufficientStock = (quantity ?? 0) > availableStock

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">
          Detalles de la Transferencia
        </h3>

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
              <p className="mt-1 text-xs text-destructive">
                {errors.itemId.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="fromLocationId">Desde *</Label>
              <select
                id="fromLocationId"
                {...register('fromLocationId')}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccionar ubicación...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              {errors.fromLocationId && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.fromLocationId.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="toLocationId">Hacia *</Label>
              <select
                id="toLocationId"
                {...register('toLocationId')}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccionar ubicación...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              {errors.toLocationId && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.toLocationId.message}
                </p>
              )}
            </div>
          </div>

          {fromLocationId && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Stock Disponible en Origen:
                </span>
                <span className="font-mono text-lg font-bold tabular-nums">
                  {isLoadingStock
                    ? '...'
                    : `${availableStock.toFixed(2)} ${selectedItem?.unit ?? ''}`}
                </span>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="quantity">Cantidad a Transferir *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              placeholder="10.00"
              {...register('quantity', { valueAsNumber: true })}
              className="mt-1"
            />
            {errors.quantity && (
              <p className="mt-1 text-xs text-destructive">
                {errors.quantity.message}
              </p>
            )}
            {hasInsufficientStock && (
              <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Stock insuficiente. Solo hay {availableStock.toFixed(2)}{' '}
                  {selectedItem?.unit ?? ''} disponibles.
                </span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={3}
              placeholder="Motivo o información adicional..."
              className="mt-1 flex w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            />
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
        <Button
          type="submit"
          variant="default"
          disabled={isSubmitting || hasInsufficientStock}
        >
          {isSubmitting ? 'Registrando...' : 'Registrar Transferencia'}
        </Button>
      </div>
    </form>
  )
}
