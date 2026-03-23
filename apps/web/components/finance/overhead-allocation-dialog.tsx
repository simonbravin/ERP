'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/format-utils'
import { allocateOverhead, getApprovedBudgetTotalByProject } from '@/app/actions/finance'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, AlertCircle, Scale, PieChart, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const allocationSchema = z
  .object({
    allocations: z
      .array(
        z.object({
          projectId: z.string().min(1, 'Selecciona un proyecto'),
          allocationPct: z
            .number()
            .min(0.01, 'Mínimo 0.01%')
            .max(100, 'Máximo 100%'),
        })
      )
      .min(1, 'Debes asignar al menos un proyecto')
      .refine(
        (allocations) => {
          const total = allocations.reduce((sum, a) => sum + a.allocationPct, 0)
          return Math.abs(total - 100) < 0.01
        },
        { message: 'La suma de porcentajes debe ser exactamente 100%' }
      ),
  })
  .refine(
    (data) => {
      const ids = data.allocations.map((a) => a.projectId).filter(Boolean)
      return new Set(ids).size === ids.length
    },
    { message: 'No se puede asignar el mismo proyecto más de una vez', path: ['allocations'] }
  )

type FormData = z.infer<typeof allocationSchema>

type ProjectOption = { id: string; name: string; projectNumber: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: {
    id: string
    description: string
    total: number
    currency: string
    totalAllocatedPct: number
    remainingAmount: number
    allocations: Array<{ projectId: string; allocationPct: number; allocationAmount: number }>
  }
  activeProjects: ProjectOption[]
  allProjects: ProjectOption[]
  onSuccess: () => void
}

export function OverheadAllocationDialog({
  open,
  onOpenChange,
  transaction,
  activeProjects,
  allProjects,
  onSuccess,
}: Props) {
  const tFin = useTranslations('finance')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scope, setScope] = useState<'active' | 'all'>('active')
  const projectsList = scope === 'all' ? allProjects : activeProjects

  const form = useForm<FormData>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      allocations: [{ projectId: '', allocationPct: 0 }],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'allocations',
  })

  const watchAllocations = form.watch('allocations')
  const totalPct = watchAllocations.reduce((sum, a) => sum + (a.allocationPct || 0), 0)
  const remainingPct = 100 - totalPct
  const isValid = Math.abs(remainingPct) < 0.01

  useEffect(() => {
    if (open && transaction) {
      if (transaction.allocations.length > 0) {
        form.reset({
          allocations: transaction.allocations.map((a) => ({
            projectId: a.projectId,
            allocationPct: a.allocationPct,
          })),
        })
      } else {
        form.reset({
          allocations: [{ projectId: '', allocationPct: 0 }],
        })
      }
    }
  }, [open, transaction, form])

  const handleNoAssign = async () => {
    setIsSubmitting(true)
    try {
      await allocateOverhead(transaction.id, [])
      form.reset({ allocations: [{ projectId: '', allocationPct: 0 }] })
      onOpenChange(false)
      onSuccess()
      toast.success(tFin('toast.overheadUnassignedSuccess'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tFin('toast.allocationUpdateError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDistributeEqually = () => {
    if (projectsList.length === 0) {
      toast.error(scope === 'active' ? 'No hay proyectos activos' : 'No hay proyectos')
      return
    }
    const n = projectsList.length
    const base = Math.floor((100 / n) * 100) / 100
    const remainder = Math.round((100 - base * n) * 100) / 100
    const allocations = projectsList.map((p, i) => ({
      projectId: p.id,
      allocationPct: i === 0 ? base + remainder : base,
    }))
    replace(allocations)
    toast.success(tFin('toast.overheadSplitEqual', { count: n }))
  }

  const handleDistributeByBudget = async () => {
    if (projectsList.length === 0) {
      toast.error(scope === 'active' ? tFin('toast.noActiveProjects') : tFin('toast.noProjects'))
      return
    }
    try {
      const totals = await getApprovedBudgetTotalByProject(projectsList.map((p) => p.id))
      const total = projectsList.reduce((sum, p) => sum + (totals[p.id] ?? 0), 0)
      if (total <= 0) {
        toast.error(tFin('toast.overheadNoApprovedBudget'))
        return
      }
      const allocations: FormData['allocations'] = projectsList.map((p) => ({
        projectId: p.id,
        allocationPct: Math.round((((totals[p.id] ?? 0) / total) * 100) * 100) / 100,
      }))
      const sum = allocations.reduce((s, a) => s + a.allocationPct, 0)
      if (allocations.length > 0) allocations[0].allocationPct += 100 - sum
      replace(allocations)
      toast.success(tFin('toast.overheadSplitByBudgetSuccess'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tFin('toast.budgetsFetchError'))
    }
  }

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await allocateOverhead(
        transaction.id,
        data.allocations.filter(
          (a): a is { projectId: string; allocationPct: number } =>
            Boolean(a.projectId) && typeof a.allocationPct === 'number'
        )
      )
      form.reset({ allocations: [{ projectId: '', allocationPct: 0 }] })
      onOpenChange(false)
      onSuccess()
      toast.success(tFin('toast.overheadAssignedOk'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tFin('toast.overheadAssignError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[min(96vw,64rem)]" style={{ maxWidth: '64rem' }}>
        <DialogHeader>
          <DialogTitle>{tFin('overheadAllocationTitle')}</DialogTitle>
          <DialogDescription>
            {tFin('overheadAllocationDescription', {
              amount: formatCurrency(transaction.remainingAmount, transaction.currency),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <span className="font-medium text-muted-foreground">Descripción</span>
              <span className="min-w-0 break-words text-foreground">{transaction.description}</span>
              <span className="font-medium text-muted-foreground">Total</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatCurrency(transaction.total, transaction.currency)}
              </span>
              <span className="font-medium text-muted-foreground">Ya asignado</span>
              <span className="tabular-nums text-foreground">
                {transaction.totalAllocatedPct.toFixed(2)}% (1 transacción)
              </span>
              <span className="font-medium text-muted-foreground">Por asignar</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatCurrency(transaction.remainingAmount, transaction.currency)}
              </span>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-sm font-medium text-muted-foreground">Asignación rápida:</span>
              <div className="flex rounded-md border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setScope('active')}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium',
                    scope === 'active'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Solo activos
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium',
                    scope === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Todos
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDistributeEqually}
                disabled={projectsList.length === 0}
              >
                <Scale className="mr-1.5 h-4 w-4" />
                Repartir equitativamente
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDistributeByBudget}
                disabled={projectsList.length === 0}
              >
                <PieChart className="mr-1.5 h-4 w-4" />
                Proporcional al presupuesto
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNoAssign}
                disabled={isSubmitting}
              >
                <Building2 className="mr-1.5 h-4 w-4" />
                No asignar a proyectos
              </Button>
              <span className="text-xs text-muted-foreground">
                Equitativo y proporcional solo rellenan el formulario; pulsá &quot;Asignar gastos generales&quot; para guardar.
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[min(100%,280px)]">Proyecto</TableHead>
                    <TableHead className="w-24 text-right">Porcentaje</TableHead>
                    <TableHead className="w-32 text-right">Monto</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} className="align-middle">
                      <TableCell className="py-2">
                        <Select
                          value={watchAllocations[index]?.projectId ?? ''}
                          onValueChange={(value) => form.setValue(`allocations.${index}.projectId`, value)}
                        >
                          <SelectTrigger
                            id={`project-${index}`}
                            className={cn(
                              'h-9 min-w-0',
                              form.formState.errors.allocations?.[index]?.projectId &&
                                'border-destructive focus-visible:ring-destructive'
                            )}
                          >
                            <SelectValue placeholder="Seleccionar proyecto" />
                          </SelectTrigger>
                          <SelectContent>
                            {projectsList.map((project) => (
                              <SelectItem
                                key={project.id}
                                value={project.id}
                                disabled={
                                  watchAllocations.some(
                                    (a, i) => i !== index && a.projectId === project.id
                                  ) ?? false
                                }
                              >
                                {project.projectNumber} — {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.allocations?.[index]?.projectId && (
                          <p className="mt-0.5 text-xs text-destructive">
                            {form.formState.errors.allocations[index]?.projectId?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Input
                          id={`pct-${index}`}
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          placeholder="0"
                          className="h-9 w-20 text-right tabular-nums"
                          {...form.register(`allocations.${index}.allocationPct`, {
                            valueAsNumber: true,
                          })}
                        />
                        {form.formState.errors.allocations?.[index]?.allocationPct && (
                          <p className="mt-0.5 text-xs text-destructive">
                            {form.formState.errors.allocations[index]?.allocationPct?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-foreground">
                        {formatCurrency(
                          (transaction.total * (watchAllocations[index]?.allocationPct || 0)) / 100,
                          transaction.currency
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          title="Quitar fila"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              type="button"
              variant="outline"
              size="default"
              className="w-full"
              onClick={() => append({ projectId: '', allocationPct: 0 })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar Proyecto
            </Button>

            <div
              className={cn(
                'flex items-center justify-between rounded-lg border px-4 py-3',
                isValid
                  ? 'border-border bg-muted/50'
                  : 'border-destructive/50 bg-destructive/5'
              )}
            >
              <span className="font-medium text-foreground">Total asignado</span>
              <span className="flex items-center gap-2 tabular-nums font-medium">
                {totalPct.toFixed(2)}%
                {isValid ? (
                  <span className="text-success">✓ Válido</span>
                ) : (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Falta {remainingPct.toFixed(2)}%
                  </span>
                )}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-2 text-right text-sm text-muted-foreground">
              Monto total asignado:{' '}
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency((transaction.total * totalPct) / 100, transaction.currency)}
              </span>
            </div>

            {form.formState.errors.allocations?.root?.message && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {form.formState.errors.allocations.root.message}
              </div>
            )}

            <DialogFooter className="flex flex-row justify-end gap-2 pt-2 sm:pt-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!isValid || isSubmitting}>
                {isSubmitting ? 'Asignando...' : 'Asignar gastos generales'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
