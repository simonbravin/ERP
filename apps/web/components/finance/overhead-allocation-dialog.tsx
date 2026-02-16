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
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/format-utils'
import { allocateOverhead } from '@/app/actions/finance'
import { toast } from 'sonner'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
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
  projects: ProjectOption[]
  onSuccess: () => void
}

export function OverheadAllocationDialog({
  open,
  onOpenChange,
  transaction,
  projects,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      allocations: [{ projectId: '', allocationPct: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
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
  }, [open, transaction?.id, transaction?.allocations?.length, form])

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await allocateOverhead(transaction.id, data.allocations)
      form.reset({ allocations: [{ projectId: '', allocationPct: 0 }] })
      onOpenChange(false)
      onSuccess()
      toast.success('Overhead asignado correctamente')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al asignar overhead')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Asignar Overhead a Proyectos</DialogTitle>
          <DialogDescription>
            Distribuye {formatCurrency(transaction.remainingAmount, transaction.currency)} entre
            proyectos activos. La suma debe ser 100%.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-sm font-medium text-muted-foreground">Descripción</span>
              <span className="text-sm font-medium text-foreground">{transaction.description}</span>
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-sm tabular-nums font-medium text-foreground">
                {formatCurrency(transaction.total, transaction.currency)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">Ya asignado</span>
              <span className="text-sm tabular-nums text-foreground">
                {transaction.totalAllocatedPct.toFixed(2)}% (1 transacción)
              </span>
              <span className="text-sm font-medium text-muted-foreground">Por asignar</span>
              <span className="text-sm tabular-nums font-medium text-foreground">
                {formatCurrency(transaction.remainingAmount, transaction.currency)}
              </span>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <Label htmlFor={`project-${index}`} className="text-sm font-medium text-foreground">
                      Proyecto
                    </Label>
                    <Select
                      value={watchAllocations[index]?.projectId ?? ''}
                      onValueChange={(value) => form.setValue(`allocations.${index}.projectId`, value)}
                    >
                      <SelectTrigger
                        id={`project-${index}`}
                        className={cn(
                          'h-10',
                          form.formState.errors.allocations?.[index]?.projectId &&
                            'border-destructive focus-visible:ring-destructive'
                        )}
                      >
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem
                            key={project.id}
                            value={project.id}
                            disabled={
                              watchAllocations.some(
                                (a, i) => i !== index && a.projectId === project.id
                              ) ?? false
                            }
                          >
                            {project.projectNumber} - {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.allocations?.[index]?.projectId && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.allocations[index]?.projectId?.message}
                      </p>
                    )}
                  </div>
                  <div className="w-24 space-y-2">
                    <Label
                      htmlFor={`pct-${index}`}
                      className="text-sm font-medium text-foreground"
                    >
                      Porcentaje
                    </Label>
                    <Input
                      id={`pct-${index}`}
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      placeholder="0.00"
                      className="h-10 text-right tabular-nums"
                      {...form.register(`allocations.${index}.allocationPct`, {
                        valueAsNumber: true,
                      })}
                    />
                    {form.formState.errors.allocations?.[index]?.allocationPct && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.allocations[index]?.allocationPct?.message}
                      </p>
                    )}
                  </div>
                  <div className="w-28 shrink-0 space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Monto</span>
                    <div className="flex h-10 items-center justify-end rounded-md border border-border bg-muted/30 px-3 text-sm tabular-nums text-foreground">
                      {formatCurrency(
                        (transaction.total * (watchAllocations[index]?.allocationPct || 0)) / 100,
                        transaction.currency
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    title="Quitar fila"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
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
              <span className="text-sm font-medium text-foreground">Total asignado</span>
              <span className="flex items-center gap-2 text-sm tabular-nums font-medium">
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

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!isValid || isSubmitting}>
                {isSubmitting ? 'Asignando...' : 'Asignar Overhead'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
