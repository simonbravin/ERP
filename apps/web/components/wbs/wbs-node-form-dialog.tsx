'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createWbsNode, updateWbsNode } from '@/app/actions/wbs'
import { wbsNodeSchema } from '@repo/validators'
import type { WbsNodeInput } from '@repo/validators'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface WbsNodeFormDialogProps {
  projectId: string
  parentId: string | null
  nodeToEdit?: {
    id: string
    code: string
    name: string
    category: string
    unit: string
    quantity: number
    description: string | null
  } | null
  onClose: () => void
}

export function WbsNodeFormDialog({
  projectId,
  parentId,
  nodeToEdit,
  onClose,
}: WbsNodeFormDialogProps) {
  const t = useTranslations('wbs')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const defaultCategory: 'PHASE' | 'TASK' | 'SUBTASK' | 'ITEM' = nodeToEdit
    ? (nodeToEdit.category as 'PHASE' | 'TASK' | 'SUBTASK' | 'ITEM')
    : parentId === null
      ? 'PHASE'
      : 'TASK'

  const form = useForm<WbsNodeInput & { quantity: string }>({
    resolver: zodResolver(wbsNodeSchema),
    defaultValues: {
      code: nodeToEdit?.code ?? '',
      name: nodeToEdit?.name ?? '',
      category: defaultCategory,
      unit: nodeToEdit?.unit ?? 'un',
      quantity: nodeToEdit?.quantity?.toString() ?? '0',
      description: nodeToEdit?.description ?? '',
    },
  })

  useEffect(() => {
    if (nodeToEdit) {
      form.reset({
        code: nodeToEdit.code,
        name: nodeToEdit.name,
        category: (nodeToEdit.category ?? defaultCategory) as 'ITEM' | 'SUBTASK' | 'TASK' | 'PHASE',
        unit: nodeToEdit.unit,
        quantity: nodeToEdit.quantity?.toString() ?? '0',
        description: nodeToEdit.description ?? '',
      })
    } else {
      form.reset({
        code: '',
        name: '',
        category: defaultCategory,
        unit: 'un',
        quantity: '0',
        description: '',
      })
    }
  }, [nodeToEdit, defaultCategory, form])

  async function onSubmit(data: WbsNodeInput & { quantity: string }) {
    setIsSubmitting(true)
    try {
      const category = data.category as 'PHASE' | 'TASK' | 'SUBTASK' | 'ITEM'
      const quantity = parseFloat(data.quantity) || 0

      const result = nodeToEdit
        ? await updateWbsNode(nodeToEdit.id, {
            code: data.code,
            name: data.name,
            category,
            unit: data.unit,
            quantity,
            description: data.description,
          })
        : await createWbsNode({
            projectId,
            parentId,
            code: data.code,
            name: data.name,
            category,
            unit: data.unit,
            quantity,
            description: data.description,
          })

      if (result.success) {
        toast.success(
          nodeToEdit ? t('nodeUpdated', { defaultValue: 'Nodo actualizado' }) : t('nodeCreated', { defaultValue: 'Nodo creado' }),
          {
            description: nodeToEdit ? t('nodeUpdatedDesc', { defaultValue: 'El nodo se actualizó correctamente' }) : t('nodeCreatedDesc', { defaultValue: 'El nodo se creó correctamente' }),
          }
        )
        router.refresh()
        onClose()
      } else {
        toast.error(result.error ?? (nodeToEdit ? t('updateError') : t('createError')))
      }
    } catch {
      toast.error(nodeToEdit ? t('updateError') : t('createError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="erp-form-modal">
        <DialogHeader>
          <DialogTitle>
            {nodeToEdit ? t('editNode', { defaultValue: 'Editar Nodo' }) : t('createNode', { defaultValue: 'Crear Nodo' })}
          </DialogTitle>
          <DialogDescription>
            {nodeToEdit ? t('editNodeDesc', { defaultValue: 'Modifica los datos del nodo WBS' }) : t('createNodeDesc', { defaultValue: 'Completa los datos del nuevo nodo WBS' })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">{t('code')} *</Label>
              <Input
                id="code"
                {...form.register('code')}
                placeholder="1.1.1"
                className="mt-1"
              />
              {form.formState.errors.code && (
                <p className="mt-1 text-sm text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{t('codeHint', { defaultValue: 'Formato: 1.1.1 (numérico, jerárquico)' })}</p>
            </div>

            <div>
              <Label htmlFor="category">{t('category')} *</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(value) => form.setValue('category', value as 'PHASE' | 'TASK' | 'SUBTASK' | 'ITEM')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHASE">{t('categoryPHASE', { defaultValue: 'Fase' })}</SelectItem>
                  <SelectItem value="TASK">{t('categoryTASK', { defaultValue: 'Tarea' })}</SelectItem>
                  <SelectItem value="SUBTASK">{t('categorySUBTASK', { defaultValue: 'Subtarea' })}</SelectItem>
                  <SelectItem value="ITEM">{t('categoryITEM', { defaultValue: 'Item' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="name">{t('name')} *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Nombre descriptivo"
              className="mt-1"
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit">{t('unit')}</Label>
              <Select
                value={form.watch('unit')}
                onValueChange={(value) => form.setValue('unit', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">Unidad (un)</SelectItem>
                  <SelectItem value="m">Metro (m)</SelectItem>
                  <SelectItem value="m2">Metro cuadrado (m²)</SelectItem>
                  <SelectItem value="m3">Metro cúbico (m³)</SelectItem>
                  <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                  <SelectItem value="tn">Tonelada (tn)</SelectItem>
                  <SelectItem value="h">Hora (h)</SelectItem>
                  <SelectItem value="gl">Global (gl)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quantity">{t('quantity')}</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                {...form.register('quantity')}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              rows={3}
              className="mt-1"
              placeholder="Descripción detallada (opcional)"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel', { defaultValue: 'Cancelar' })}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('saving', { defaultValue: 'Guardando...' }) : nodeToEdit ? t('update', { defaultValue: 'Actualizar' }) : t('create', { defaultValue: 'Crear' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
