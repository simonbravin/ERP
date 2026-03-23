'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createInventoryMovement, getItemStockByLocation, getProjectWBSNodes } from '@/app/actions/inventory'
import { formatCurrency } from '@/lib/format-utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

const issueSchema = z.object({
  itemId: z.string().min(1, 'Selecciona un item'),
  fromLocationId: z.string().min(1, 'Selecciona ubicación (obra)'),
  projectId: z.string().min(1, 'Selecciona proyecto'),
  wbsNodeId: z.string().min(1, 'Selecciona partida WBS'),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  notes: z.string().optional(),
})

type IssueInput = z.infer<typeof issueSchema>

function idempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

interface IssueFormProps {
  items: Array<{ id: string; sku: string; name: string; unit: string }>
  locations: Array<{ id: string; name: string }>
  projects: Array<{ id: string; projectNumber: string; name: string }>
  initialItemId?: string
}

export function IssueForm({
  items,
  locations,
  projects,
  initialItemId,
}: IssueFormProps) {
  const t = useTranslations('inventory')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItem, setSelectedItem] = useState<
    { id: string; sku: string; name: string; unit: string } | undefined
  >(items.find((i) => i.id === initialItemId))
  const [selectedWBS, setSelectedWBS] = useState<
    { id: string; code: string; name: string } | undefined
  >()
  const [availableStock, setAvailableStock] = useState(0)
  const [wbsNodes, setWbsNodes] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [isLoadingStock, setIsLoadingStock] = useState(false)
  const [isLoadingWBS, setIsLoadingWBS] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IssueInput>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      itemId: initialItemId ?? '',
      fromLocationId: '',
      projectId: '',
      wbsNodeId: '',
      quantity: 1,
      unitCost: 0,
    },
  })

  const itemId = watch('itemId')
  const fromLocationId = watch('fromLocationId')
  const projectId = watch('projectId')
  const quantity = watch('quantity')
  const unitCost = watch('unitCost')

  useEffect(() => {
    if (itemId && fromLocationId) {
      setIsLoadingStock(true)
      getItemStockByLocation(itemId, fromLocationId)
        .then((result) => {
          if (result.success) setAvailableStock(result.stock ?? 0)
          else setAvailableStock(0)
        })
        .finally(() => setIsLoadingStock(false))
    } else {
      setAvailableStock(0)
    }
  }, [itemId, fromLocationId])

  useEffect(() => {
    if (projectId) {
      setIsLoadingWBS(true)
      getProjectWBSNodes(projectId)
        .then((result) => {
          if (result.success) setWbsNodes(result.nodes ?? [])
          else setWbsNodes([])
          setValue('wbsNodeId', '')
          setSelectedWBS(undefined)
        })
        .finally(() => setIsLoadingWBS(false))
    } else {
      setWbsNodes([])
      setValue('wbsNodeId', '')
      setSelectedWBS(undefined)
    }
  }, [projectId, setValue])

  const totalCost = (quantity ?? 0) * (unitCost ?? 0)
  const hasInsufficientStock = (quantity ?? 0) > availableStock

  async function onSubmit(data: IssueInput) {
    if (hasInsufficientStock) {
      toast.error(
        t('toast.insufficientStockDetail', {
          available: availableStock.toFixed(2),
          unit: selectedItem?.unit ?? '',
        })
      )
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createInventoryMovement({
        movementType: 'ISSUE',
        itemId: data.itemId,
        fromLocationId: data.fromLocationId,
        toLocationId: null,
        projectId: data.projectId,
        wbsNodeId: data.wbsNodeId,
        quantity: data.quantity,
        unitCost: data.unitCost,
        notes: data.notes,
        idempotencyKey: idempotencyKey(`issue_${data.itemId}`),
      })

      if (result.success) {
        toast.success(t('toast.issueOk'))
        router.push('/inventory/movements')
        router.refresh()
      } else {
        toast.error(t('toast.issueError'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Importante:</strong> El consumo cargará el costo al presupuesto del proyecto en la partida WBS seleccionada y creará una transacción financiera tipo EXPENSE.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Material a Consumir</h3>

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
            <Label htmlFor="fromLocationId">Ubicación (Obra) *</Label>
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
              <p className="mt-1 text-xs text-destructive">{errors.fromLocationId.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Solo ubicaciones tipo Obra
            </p>
          </div>

          {fromLocationId && itemId && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Stock disponible en ubicación:
                </span>
                <span className="font-mono text-lg font-bold tabular-nums">
                  {isLoadingStock
                    ? '...'
                    : `${availableStock.toFixed(2)} ${selectedItem?.unit ?? ''}`}
                </span>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="quantity">Cantidad a consumir *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="10.00"
                {...register('quantity', { valueAsNumber: true })}
                className="mt-1"
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-destructive">{errors.quantity.message}</p>
              )}
              {hasInsufficientStock && (
                <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Stock insuficiente. Solo hay {availableStock.toFixed(2)} disponibles.
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="unitCost">Costo unitario (ARS) *</Label>
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
                <p className="mt-1 text-xs text-destructive">{errors.unitCost.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Editable por variaciones de precio
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Asignación al Proyecto</h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="projectId">Proyecto *</Label>
            <select
              id="projectId"
              {...register('projectId')}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccionar proyecto...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectNumber} - {project.name}
                </option>
              ))}
            </select>
            {errors.projectId && (
              <p className="mt-1 text-xs text-destructive">{errors.projectId.message}</p>
            )}
          </div>

          {projectId && (
            <div>
              <Label htmlFor="wbsNodeId">Partida WBS *</Label>
              <select
                id="wbsNodeId"
                {...register('wbsNodeId')}
                onChange={(e) => {
                  const node = wbsNodes.find((n) => n.id === e.target.value)
                  setSelectedWBS(node)
                }}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
                disabled={isLoadingWBS}
              >
                <option value="">Seleccionar partida...</option>
                {wbsNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.code} - {node.name}
                  </option>
                ))}
              </select>
              {errors.wbsNodeId && (
                <p className="mt-1 text-xs text-destructive">{errors.wbsNodeId.message}</p>
              )}
              {isLoadingWBS && (
                <p className="mt-1 text-xs text-muted-foreground">Cargando partidas...</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={3}
              placeholder="Motivo del consumo, actividad..."
              className="mt-1 flex w-full rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Resumen del Consumo</h3>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Material:</span>
            <span className="font-medium">{selectedItem?.name ?? '-'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cantidad:</span>
            <span className="font-mono tabular-nums">
              {(quantity ?? 0).toFixed(2)} {selectedItem?.unit ?? ''}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Costo unitario:</span>
            <span className="font-mono tabular-nums">{formatCurrency(unitCost ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">WBS:</span>
            <span className="font-medium">
              {selectedWBS ? `${selectedWBS.code} - ${selectedWBS.name}` : '-'}
            </span>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex justify-between">
              <span className="font-semibold">Costo total a cargar:</span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {formatCurrency(totalCost)}
              </span>
            </div>
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
          disabled={isSubmitting || hasInsufficientStock}
        >
          {isSubmitting ? 'Registrando...' : 'Registrar Consumo'}
        </Button>
      </div>
    </form>
  )
}
