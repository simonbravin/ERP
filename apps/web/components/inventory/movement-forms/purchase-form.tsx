'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createInventoryMovement, getProjectWBSNodes } from '@/app/actions/inventory'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/format-utils'

const purchaseSchema = z.object({
  itemId: z.string().min(1, 'Selecciona un item'),
  toLocationId: z.string().min(1, 'Selecciona una ubicación'),
  supplierId: z.string().optional(),
  projectId: z.string().optional(),
  wbsNodeId: z.string().optional(),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  notes: z.string().optional(),
})

type PurchaseInput = z.infer<typeof purchaseSchema>

interface PurchaseFormProps {
  items: Array<{ id: string; sku: string; name: string; unit: string }>
  locations: Array<{ id: string; name: string; type?: string }>
  projects: Array<{ id: string; projectNumber: string; name: string }>
  suppliers: Array<{ id: string; name: string }>
  initialItemId?: string
}

function idempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

export function PurchaseForm({
  items,
  locations,
  projects,
  suppliers,
  initialItemId,
}: PurchaseFormProps) {
  const t = useTranslations('inventory')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [wbsNodes, setWbsNodes] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [isLoadingWBS, setIsLoadingWBS] = useState(false)
  const [selectedItem, setSelectedItem] = useState<
    { id: string; sku: string; name: string; unit: string } | undefined
  >(items.find((i) => i.id === initialItemId))

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseInput>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      itemId: initialItemId ?? '',
      toLocationId: locations[0]?.id ?? '',
      projectId: '',
      wbsNodeId: '',
      quantity: 1,
      unitCost: 0,
    },
  })

  const projectId = watch('projectId')

  useEffect(() => {
    if (projectId) {
      setIsLoadingWBS(true)
      getProjectWBSNodes(projectId)
        .then((result) => {
          if (result.success) setWbsNodes(result.nodes ?? [])
          else setWbsNodes([])
          setValue('wbsNodeId', '')
        })
        .finally(() => setIsLoadingWBS(false))
    } else {
      setWbsNodes([])
      setValue('wbsNodeId', '')
    }
  }, [projectId, setValue])

  const quantity = watch('quantity')
  const unitCost = watch('unitCost')
  const totalCost = (quantity ?? 0) * (unitCost ?? 0)

  async function onSubmit(data: PurchaseInput) {
    setIsSubmitting(true)
    try {
      const result = await createInventoryMovement({
        movementType: 'PURCHASE',
        itemId: data.itemId,
        toLocationId: data.toLocationId,
        projectId: data.projectId?.trim() || null,
        wbsNodeId: data.wbsNodeId?.trim() || null,
        quantity: data.quantity,
        unitCost: data.unitCost,
        notes: data.notes,
        idempotencyKey: idempotencyKey(`purchase_${data.itemId}`),
      })

      if (result.success) {
        toast.success(t('toast.purchaseOk'))
        router.push('/inventory/movements')
        router.refresh()
      } else {
        toast.error(t('toast.purchaseError'))
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
        <h3 className="mb-4 text-lg font-semibold">Detalles de la Compra</h3>

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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="quantity">Cantidad *</Label>
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
            </div>
            <div>
              <Label>Unidad</Label>
              <Input
                value={selectedItem?.unit ?? '-'}
                disabled
                className="mt-1 bg-muted"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="toLocationId">Ubicación Destino *</Label>
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

          <div>
            <Label htmlFor="projectId">Proyecto (opcional)</Label>
            <select
              id="projectId"
              {...register('projectId')}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            >
              <option value="">Sin proyecto (solo inventario)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.projectNumber})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Si eliges un proyecto, el gasto se imputará a sus finanzas
            </p>
          </div>

          {projectId && (
            <div>
              <Label htmlFor="wbsNodeId">Partida WBS (opcional)</Label>
              <select
                id="wbsNodeId"
                {...register('wbsNodeId')}
                disabled={isLoadingWBS}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
              >
                <option value="">Sin partida específica</option>
                {wbsNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.code} – {n.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="supplierId">Proveedor (opcional)</Label>
            <select
              id="supplierId"
              {...register('supplierId')}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            >
              <option value="">Sin proveedor específico</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="unitCost">Costo Unitario (ARS) *</Label>
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
              <p className="mt-1 text-xs text-destructive">
                {errors.unitCost.message}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Este costo es editable por variaciones de inflación/mercado
            </p>
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={3}
              placeholder="Información adicional sobre la compra..."
              className="mt-1 flex w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Resumen</h3>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Item:</span>
            <span className="font-medium">{selectedItem?.name ?? '-'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cantidad:</span>
            <span className="font-mono tabular-nums">
              {(quantity ?? 0).toFixed(2)} {selectedItem?.unit ?? ''}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Costo Unitario:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(unitCost ?? 0)}
            </span>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex justify-between">
              <span className="font-semibold">Costo Total:</span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {formatCurrency(totalCost)}
              </span>
            </div>
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
          {isSubmitting ? 'Registrando...' : 'Registrar Compra'}
        </Button>
      </div>
    </form>
  )
}
