'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  addBudgetResource,
  updateBudgetResource,
  deleteBudgetResource,
  getBudgetLineWithResources,
} from '@/app/actions/budget'
import { toast } from 'sonner'
import { formatCurrency, formatNumber } from '@/lib/format-utils'
import { RESOURCE_TYPES } from '@/lib/constants/budget'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'

interface BudgetResourceRow {
  id: string
  type: string
  name: string
  description: string | null
  unit: string
  quantity: number
  unitCost: number
  totalCost: number
  supplierName: string | null
}

interface BudgetLineData {
  id: string
  wbsNode: { code: string; name: string }
  description: string
  unit: string
  quantity: number
  resources: BudgetResourceRow[]
}

interface APUEditorDialogProps {
  budgetLineId: string
  versionId: string
  onClose: () => void
}

export function APUEditorDialog({
  budgetLineId,
  versionId,
  onClose,
}: APUEditorDialogProps) {
  const t = useTranslations('budget')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [budgetLine, setBudgetLine] = useState<BudgetLineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('materials')

  const [newResource, setNewResource] = useState({
    type: 'MATERIAL',
    name: '',
    description: '',
    unit: 'un',
    quantity: '0',
    unitCost: '0',
    supplierName: '',
  })

  useEffect(() => {
    getBudgetLineWithResources(budgetLineId)
      .then((data) => {
        setBudgetLine(data ?? null)
      })
      .catch(() => {
        toast.error(t('error'))
      })
      .finally(() => setIsLoading(false))
  }, [budgetLineId, t])

  const totals = budgetLine?.resources.reduce(
    (acc, r) => {
      const total = r.quantity * r.unitCost
      if (r.type === RESOURCE_TYPES.MATERIAL) acc.materials += total
      else if (r.type === RESOURCE_TYPES.LABOR) acc.labor += total
      else if (r.type === RESOURCE_TYPES.EQUIPMENT || r.type === 'SUBCONTRACT') acc.equipment += total
      acc.total += total
      return acc
    },
    { materials: 0, labor: 0, equipment: 0, total: 0 }
  ) ?? { materials: 0, labor: 0, equipment: 0, total: 0 }

  const projectTotal = totals.total * (budgetLine?.quantity ?? 0)

  const typeForTab = activeTab === 'materials' ? RESOURCE_TYPES.MATERIAL : activeTab === 'labor' ? RESOURCE_TYPES.LABOR : RESOURCE_TYPES.EQUIPMENT

  function handleAddResource() {
    if (!newResource.name.trim() || !budgetLine) return

    startTransition(async () => {
      const result = await addBudgetResource(budgetLineId, {
        type: typeForTab as 'MATERIAL' | 'LABOR' | 'EQUIPMENT',
        name: newResource.name.trim(),
        description: newResource.description.trim() || null,
        unit: newResource.unit,
        quantity: parseFloat(newResource.quantity) || 0,
        unitCost: parseFloat(newResource.unitCost) || 0,
        supplierName: newResource.supplierName.trim() || null,
      })

      if (result.success && result.resource) {
        setBudgetLine({
          ...budgetLine,
          resources: [...budgetLine.resources, result.resource!],
        })
        setNewResource({
          type: typeForTab,
          name: '',
          description: '',
          unit: newResource.unit,
          quantity: '0',
          unitCost: '0',
          supplierName: '',
        })
        toast.success(t('resourceAdded', { defaultValue: 'Recurso agregado' }))
      } else {
        toast.error(result.error ?? t('addResourceError', { defaultValue: 'Error al agregar' }))
      }
    })
  }

  function handleDeleteResource(resourceId: string) {
    if (!confirm(t('confirmDeleteResource', { defaultValue: '¿Eliminar este recurso?' })) || !budgetLine) return

    startTransition(async () => {
      const result = await deleteBudgetResource(resourceId)
      if (result.success) {
        setBudgetLine({
          ...budgetLine,
          resources: budgetLine.resources.filter((r) => r.id !== resourceId),
        })
        toast.success(t('resourceDeleted', { defaultValue: 'Recurso eliminado' }))
      } else {
        toast.error(result.error ?? t('deleteResourceError', { defaultValue: 'Error al eliminar' }))
      }
    })
  }

  function handleUpdateResource(resourceId: string, field: string, value: string | number) {
    if (!budgetLine) return

    const resource = budgetLine.resources.find((r) => r.id === resourceId)
    if (!resource) return

    setBudgetLine({
      ...budgetLine,
      resources: budgetLine.resources.map((r) =>
        r.id === resourceId ? { ...r, [field]: value } : r
      ),
    })

    startTransition(async () => {
      const payload: Record<string, string | number | null> = {}
      if (field === 'name') payload.name = value as string
      if (field === 'description') payload.description = (value as string) || null
      if (field === 'unit') payload.unit = value as string
      if (field === 'quantity') payload.quantity = value as number
      if (field === 'unitCost') payload.unitCost = value as number
      if (field === 'supplierName') payload.supplierName = (value as string) || null

      const result = await updateBudgetResource(resourceId, payload)
      if (!result.success) {
        toast.error(result.error ?? t('updateResourceError', { defaultValue: 'Error al actualizar' }))
      }
    })
  }

  function handleSaveAndClose() {
    router.refresh()
    onClose()
  }

  if (isLoading) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-6xl max-h-[90vh]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Cargando APU…</DialogTitle>
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!budgetLine) return null

  const materials = budgetLine.resources.filter((r) => r.type === RESOURCE_TYPES.MATERIAL)
  const labor = budgetLine.resources.filter((r) => r.type === RESOURCE_TYPES.LABOR)
  const equipment = budgetLine.resources.filter((r) => r.type === RESOURCE_TYPES.EQUIPMENT || r.type === 'SUBCONTRACT')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            APU - Análisis de Precio Unitario
            <Badge variant="outline" className="ml-2">
              {budgetLine.wbsNode.code}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {budgetLine.wbsNode.name} - {budgetLine.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-4 rounded-lg border border-border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('materials', { defaultValue: 'Materiales' })}</p>
            <p className="mt-1 text-xl font-semibold text-blue-600 dark:text-blue-400">
              {formatCurrency(totals.materials)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('labor', { defaultValue: 'Mano de obra' })}</p>
            <p className="mt-1 text-xl font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(totals.labor)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('equipment', { defaultValue: 'Equipos' })}</p>
            <p className="mt-1 text-xl font-semibold text-orange-600 dark:text-orange-400">
              {formatCurrency(totals.equipment)}
            </p>
          </div>
          <div className="border-l-2 border-border pl-4">
            <p className="text-sm font-medium text-muted-foreground">{t('directCostUnit', { defaultValue: 'Costo directo/u' })}</p>
            <p className="mt-1 text-xl font-bold">{formatCurrency(totals.total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('projectTotal', { defaultValue: 'Total proyecto' })}: {formatCurrency(projectTotal)}{' '}
              <span className="ml-1">
                ({formatNumber(budgetLine.quantity)} {budgetLine.unit})
              </span>
            </p>
          </div>
        </div>

        <Separator />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="materials">
              {t('materials', { defaultValue: 'Materiales' })} ({materials.length})
            </TabsTrigger>
            <TabsTrigger value="labor">
              {t('labor', { defaultValue: 'Mano de obra' })} ({labor.length})
            </TabsTrigger>
            <TabsTrigger value="equipment">
              {t('equipment', { defaultValue: 'Equipos' })} ({equipment.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="space-y-4">
            <ResourceTable
              resources={materials}
              type="MATERIAL"
              onUpdate={handleUpdateResource}
              onDelete={handleDeleteResource}
              isPending={isPending}
              t={t}
            />
            <AddResourceForm
              type="MATERIAL"
              resource={newResource}
              onChange={setNewResource}
              onAdd={handleAddResource}
              isPending={isPending}
              t={t}
            />
          </TabsContent>

          <TabsContent value="labor" className="space-y-4">
            <ResourceTable
              resources={labor}
              type="LABOR"
              onUpdate={handleUpdateResource}
              onDelete={handleDeleteResource}
              isPending={isPending}
              t={t}
            />
            <AddResourceForm
              type="LABOR"
              resource={newResource}
              onChange={setNewResource}
              onAdd={handleAddResource}
              isPending={isPending}
              t={t}
            />
          </TabsContent>

          <TabsContent value="equipment" className="space-y-4">
            <ResourceTable
              resources={equipment}
              type={RESOURCE_TYPES.EQUIPMENT}
              onUpdate={handleUpdateResource}
              onDelete={handleDeleteResource}
              isPending={isPending}
              t={t}
            />
            <AddResourceForm
              type={RESOURCE_TYPES.EQUIPMENT}
              resource={newResource}
              onChange={setNewResource}
              onAdd={handleAddResource}
              isPending={isPending}
              t={t}
            />
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            {t('cancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button onClick={handleSaveAndClose}>
            <Save className="mr-2 h-4 w-4" />
            {t('saveAndClose', { defaultValue: 'Guardar y cerrar' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ResourceTable({
  resources,
  type,
  onUpdate,
  onDelete,
  isPending,
  t,
}: {
  resources: BudgetResourceRow[]
  type: string
  onUpdate: (id: string, field: string, value: string | number) => void
  onDelete: (id: string) => void
  isPending: boolean
  t: (key: string, opts?: { defaultValue?: string }) => string
}) {
  if (resources.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        {t('noResourcesYet', { defaultValue: 'Aún no hay recursos' })}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">{t('name', { defaultValue: 'Nombre' })}</TableHead>
            <TableHead className="w-[250px]">{t('description', { defaultValue: 'Descripción' })}</TableHead>
            <TableHead className="w-[100px]">{t('unit', { defaultValue: 'Unidad' })}</TableHead>
            <TableHead className="w-[100px] text-right">{t('quantity', { defaultValue: 'Cantidad' })}</TableHead>
            <TableHead className="w-[120px] text-right">{t('unitCost', { defaultValue: 'Costo u.' })}</TableHead>
            <TableHead className="w-[120px] text-right">{t('subtotal', { defaultValue: 'Subtotal' })}</TableHead>
            {type === RESOURCE_TYPES.MATERIAL && (
              <TableHead className="w-[150px]">{t('supplier', { defaultValue: 'Proveedor' })}</TableHead>
            )}
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => (
            <TableRow key={resource.id}>
              <TableCell>
                <Input
                  value={resource.name}
                  onChange={(e) => onUpdate(resource.id, 'name', e.target.value)}
                  className="h-8"
                  disabled={isPending}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={resource.description ?? ''}
                  onChange={(e) => onUpdate(resource.id, 'description', e.target.value)}
                  className="h-8"
                  disabled={isPending}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={resource.unit}
                  onChange={(e) => onUpdate(resource.id, 'unit', e.target.value)}
                  className="h-8"
                  disabled={isPending}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={resource.quantity}
                  onChange={(e) => onUpdate(resource.id, 'quantity', parseFloat(e.target.value) || 0)}
                  className="h-8 text-right"
                  disabled={isPending}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={resource.unitCost}
                  onChange={(e) => onUpdate(resource.id, 'unitCost', parseFloat(e.target.value) || 0)}
                  className="h-8 text-right"
                  disabled={isPending}
                />
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatCurrency(resource.quantity * resource.unitCost)}
              </TableCell>
              {type === RESOURCE_TYPES.MATERIAL && (
                <TableCell>
                  <Input
                    value={resource.supplierName ?? ''}
                    onChange={(e) => onUpdate(resource.id, 'supplierName', e.target.value)}
                    className="h-8"
                    placeholder={t('supplier', { defaultValue: 'Proveedor' })}
                    disabled={isPending}
                  />
                </TableCell>
              )}
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(resource.id)}
                  disabled={isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function AddResourceForm({
  type,
  resource,
  onChange,
  onAdd,
  isPending,
  t,
}: {
  type: string
  resource: { type: string; name: string; description: string; unit: string; quantity: string; unitCost: string; supplierName: string }
  onChange: (r: typeof resource) => void
  onAdd: () => void
  isPending: boolean
  t: (key: string, opts?: { defaultValue?: string }) => string
}) {
  const unitOptions =
    type === 'MATERIAL'
      ? ['un', 'kg', 'm', 'm2', 'm3', 'l', 'bolsa']
      : type === 'LABOR'
        ? ['h', 'día', 'mes']
        : ['gl', 'un', 'm2']

  const typeLabel =
    type === 'MATERIAL'
      ? t('materials', { defaultValue: 'Material' })
      : type === 'LABOR'
        ? t('labor', { defaultValue: 'Mano de obra' })
        : t('equipment', { defaultValue: 'Equipo' })

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h4 className="mb-3 text-sm font-medium">
        {t('addNew', { defaultValue: 'Agregar' })} {typeLabel}
      </h4>
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-2">
          <Input
            placeholder={t('name', { defaultValue: 'Nombre' })}
            value={resource.name}
            onChange={(e) => onChange({ ...resource, name: e.target.value })}
            disabled={isPending}
          />
        </div>
        <div className="col-span-3">
          <Input
            placeholder={t('description', { defaultValue: 'Descripción' })}
            value={resource.description}
            onChange={(e) => onChange({ ...resource, description: e.target.value })}
            disabled={isPending}
          />
        </div>
        <div className="col-span-1">
          <Select
            value={resource.unit}
            onValueChange={(value) => onChange({ ...resource, unit: value })}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-1">
          <Input
            type="number"
            step="0.01"
            placeholder={t('quantity', { defaultValue: 'Cant.' })}
            value={resource.quantity}
            onChange={(e) => onChange({ ...resource, quantity: e.target.value })}
            disabled={isPending}
          />
        </div>
        <div className="col-span-2">
          <Input
            type="number"
            step="0.01"
            placeholder={t('unitCost', { defaultValue: 'Costo u.' })}
            value={resource.unitCost}
            onChange={(e) => onChange({ ...resource, unitCost: e.target.value })}
            disabled={isPending}
          />
        </div>
        {type === RESOURCE_TYPES.MATERIAL && (
          <div className="col-span-2">
            <Input
              placeholder={t('supplier', { defaultValue: 'Proveedor' })}
              value={resource.supplierName}
              onChange={(e) => onChange({ ...resource, supplierName: e.target.value })}
              disabled={isPending}
            />
          </div>
        )}
        <div className={type === RESOURCE_TYPES.MATERIAL ? 'col-span-1' : 'col-span-3'}>
          <Button onClick={onAdd} disabled={!resource.name.trim() || isPending} className="w-full">
            <Plus className="mr-1 h-4 w-4" />
            {t('add', { defaultValue: 'Agregar' })}
          </Button>
        </div>
      </div>
    </div>
  )
}
