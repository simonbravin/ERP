'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import {
  createProjectTransaction,
  updateProjectTransaction,
  createCompanyTransaction,
  getPartiesForProject,
  createPartyForTransaction,
} from '@/app/actions/finance'
import {
  listDocumentsForEntity,
  linkDocumentToEntity,
  createDocument,
  getDocumentDownloadUrl,
} from '@/app/actions/documents'
import { FINANCE_TRANSACTION_ENTITY } from '@/lib/document-entities'
import { DOCUMENT_TYPE_LABELS, getStatusLabel } from '@/lib/finance-labels'
import { PartyCombobox } from './party-combobox'
import { toast } from 'sonner'
import {
  PROJECT_TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  DOCUMENT_TYPE,
  type ProjectTransactionCreateInput,
} from '@repo/validators'
import { Paperclip, FileDown, Loader2 } from 'lucide-react'

const formSchema = z.object({
  type: z.enum(PROJECT_TRANSACTION_TYPE),
  documentType: z.enum(DOCUMENT_TYPE).optional().default('INVOICE'),
  partyId: z.string().uuid().optional().nullable(),
  description: z.string().min(3, 'Mínimo 3 caracteres'),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  currency: z.string().length(3).default('ARS'),
  exchangeRate: z.number().positive().optional(),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  reference: z.string().max(200).optional().nullable(),
  retentionAmount: z.number().nonnegative().optional().default(0),
  adjustmentAmount: z.number().optional().default(0),
  adjustmentNotes: z.string().max(1000).optional().nullable(),
  status: z.enum(TRANSACTION_STATUS).optional(),
})

type FormData = z.infer<typeof formSchema>

export type TransactionForEdit = {
  id: string
  type: string
  status?: string
  description: string
  issueDate: Date
  dueDate?: Date | null
  currency: string
  partyId?: string | null
  party?: { id: string; name: string } | null
  subtotal?: { toNumber?: () => number } | number
  taxTotal?: { toNumber?: () => number } | number
  total: { toNumber?: () => number } | number
  reference?: string | null
}

function toNum(v: { toNumber?: () => number } | number): number {
  return typeof v === 'object' && v !== null && 'toNumber' in v
    ? (v as { toNumber: () => number }).toNumber()
    : Number(v)
}

interface Props {
  /** null = company-level (overhead / sin proyecto); string = project-level */
  projectId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Transaction from list (ProjectTransactionRow) or minimal edit shape */
  transaction?: TransactionForEdit | null
  onSuccess: (transaction: Record<string, unknown>) => void
  /** When projectId is null, pass org parties for supplier/client combobox */
  companiesParties?: Array<{ id: string; name: string; partyType: string }>
}

export function TransactionFormDialog({
  projectId,
  open,
  onOpenChange,
  transaction,
  onSuccess,
  companiesParties = [],
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [parties, setParties] = useState<{ id: string; name: string }[]>([])
  const [attachmentDocs, setAttachmentDocs] = useState<{ id: string; documentId: string; title: string; docType: string; versionId: string; fileName: string }[]>([])
  const [attachmentLoading, setAttachmentLoading] = useState(false)
  const [attachUploading, setAttachUploading] = useState(false)
  const isEditing = !!transaction
  const isCompanyLevel = projectId == null
  const canAttach = isEditing && transaction?.id && projectId != null

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'EXPENSE',
      documentType: 'INVOICE',
      partyId: null,
      description: '',
      issueDate: new Date(),
      dueDate: undefined,
      currency: 'ARS',
      exchangeRate: undefined,
      subtotal: 0,
      taxTotal: 0,
      total: 0,
      reference: '',
      retentionAmount: 0,
      adjustmentAmount: 0,
      adjustmentNotes: null,
      status: 'DRAFT',
    },
  })

  const txType = form.watch('type')
  const showPartyAsSupplier = txType === 'EXPENSE' || txType === 'PURCHASE' || txType === 'OVERHEAD'
  const showPartyAsClient = txType === 'INCOME' || txType === 'SALE'

  useEffect(() => {
    if (!open) return
    if (isCompanyLevel) {
      const partyType = showPartyAsSupplier ? 'SUPPLIER' : showPartyAsClient ? 'CLIENT' : null
      if (partyType) {
        const filtered = companiesParties
          .filter((p) => p.partyType === partyType)
          .map((p) => ({ id: p.id, name: p.name }))
        setParties(filtered)
      } else {
        setParties([])
      }
    } else {
      const partyType = showPartyAsSupplier ? 'SUPPLIER' : showPartyAsClient ? 'CLIENT' : null
      if (partyType && projectId) {
        getPartiesForProject(projectId, partyType).then(setParties)
      } else {
        setParties([])
      }
    }
  }, [open, projectId, isCompanyLevel, companiesParties, showPartyAsSupplier, showPartyAsClient])

  useEffect(() => {
    if (transaction) {
      form.reset({
        type: transaction.type as FormData['type'],
        documentType: (transaction.documentType ?? 'INVOICE') as FormData['documentType'],
        partyId: transaction.partyId ?? transaction.party?.id ?? null,
        description: transaction.description,
        issueDate: new Date(transaction.issueDate).toISOString().slice(0, 10) as unknown as Date,
        dueDate: transaction.dueDate ? (new Date(transaction.dueDate).toISOString().slice(0, 10) as unknown as Date) : undefined,
        currency: transaction.currency ?? 'ARS',
        exchangeRate: undefined,
        subtotal: transaction.subtotal != null ? toNum(transaction.subtotal) : 0,
        taxTotal: transaction.taxTotal != null ? toNum(transaction.taxTotal) : 0,
        total: toNum(transaction.total),
        reference: transaction.reference ?? '',
        retentionAmount: transaction.retentionAmount != null ? toNum(transaction.retentionAmount) : 0,
        adjustmentAmount: transaction.adjustmentAmount != null ? toNum(transaction.adjustmentAmount) : 0,
        adjustmentNotes: transaction.adjustmentNotes ?? null,
        status: (transaction.status ?? 'DRAFT') as FormData['status'],
      })
    } else {
      form.reset({
        type: 'EXPENSE',
        documentType: 'INVOICE',
        partyId: null,
        description: '',
        issueDate: new Date(),
        dueDate: undefined,
        currency: 'ARS',
        exchangeRate: undefined,
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        reference: '',
        retentionAmount: 0,
        adjustmentAmount: 0,
        adjustmentNotes: null,
        status: 'DRAFT',
      })
    }
  }, [transaction, open, form])

  const subtotal = form.watch('subtotal') ?? 0
  const taxTotal = form.watch('taxTotal') ?? 0
  useEffect(() => {
    const t = subtotal + taxTotal
    if (form.getValues('total') !== t) {
      form.setValue('total', t)
    }
  }, [subtotal, taxTotal, form])

  useEffect(() => {
    if (!open || !canAttach || !transaction?.id) return
    setAttachmentLoading(true)
    listDocumentsForEntity(FINANCE_TRANSACTION_ENTITY, transaction.id)
      .then(setAttachmentDocs)
      .catch(() => setAttachmentDocs([]))
      .finally(() => setAttachmentLoading(false))
  }, [open, canAttach, transaction?.id])

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !transaction?.id || !projectId) return
    e.target.value = ''
    setAttachUploading(true)
    try {
      const formData = new FormData()
      formData.set('projectId', projectId)
      formData.set('title', file.name.replace(/\.[^.]+$/, '').trim() || file.name)
      formData.set('docType', 'INVOICE')
      formData.set('file', file)
      const result = await createDocument(formData)
      if (result && 'docId' in result) {
        await linkDocumentToEntity(result.docId, FINANCE_TRANSACTION_ENTITY, transaction.id)
        const list = await listDocumentsForEntity(FINANCE_TRANSACTION_ENTITY, transaction.id)
        setAttachmentDocs(list)
        toast.success('Documento adjuntado')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo adjuntar')
    } finally {
      setAttachUploading(false)
    }
  }

  async function handleDownloadAttachment(versionId: string) {
    try {
      const { url } = await getDocumentDownloadUrl(versionId)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo descargar')
    }
  }

  async function handleSubmit(data: FormData) {
    setIsSubmitting(true)
    try {
      if (isEditing) {
        const result = await updateProjectTransaction(transaction.id, {
          description: data.description,
          documentType: data.documentType,
          status: data.status,
          partyId: data.partyId ?? undefined,
          currency: data.currency,
          exchangeRate: data.currency !== 'ARS' && data.exchangeRate != null ? data.exchangeRate : undefined,
          issueDate: data.issueDate,
          dueDate: data.dueDate ?? undefined,
          reference: data.reference ?? undefined,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          retentionAmount: data.retentionAmount,
          adjustmentAmount: data.adjustmentAmount,
          adjustmentNotes: data.adjustmentNotes ?? undefined,
        })
        if (result && 'error' in result && result.error) {
          const err = result.error as Record<string, string[]>
          if (err._form) toast.error(err._form[0])
          Object.entries(err).forEach(([field, msgs]) => {
            if (field !== '_form' && msgs?.[0])
              form.setError(field as keyof FormData, { message: msgs[0] })
          })
          return
        }
        const updated = result && 'transaction' in result ? result.transaction : null
        if (updated) {
          toast.success('Transacción actualizada')
          onSuccess(updated as Record<string, unknown>)
        }
      } else if (isCompanyLevel) {
        const companyType = data.type as 'EXPENSE' | 'INCOME' | 'OVERHEAD'
        if (!['EXPENSE', 'INCOME', 'OVERHEAD'].includes(companyType)) {
          toast.error('En nivel empresa solo se permiten Gasto, Ingreso o Generales.')
          return
        }
        const result = await createCompanyTransaction({
          type: companyType,
          documentType: data.documentType ?? 'INVOICE',
          partyId: data.partyId ?? undefined,
          description: data.description,
          issueDate: data.issueDate,
          dueDate: data.dueDate ?? undefined,
          currency: data.currency,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          reference: data.reference ?? undefined,
          retentionAmount: data.retentionAmount ?? 0,
          adjustmentAmount: data.adjustmentAmount ?? 0,
          adjustmentNotes: data.adjustmentNotes ?? undefined,
        })
        if (result && 'error' in result && result.error) {
          toast.error(String(result.error))
          return
        }
        const created = result && 'transaction' in result ? result.transaction : null
        if (created) {
          toast.success('Transacción creada')
          onSuccess(created as Record<string, unknown>)
        }
      } else {
        const payload: ProjectTransactionCreateInput = {
          type: data.type,
          documentType: data.documentType ?? 'INVOICE',
          partyId: data.partyId ?? undefined,
          description: data.description,
          issueDate: data.issueDate,
          dueDate: data.dueDate ?? undefined,
          currency: data.currency,
          exchangeRate: data.currency !== 'ARS' && data.exchangeRate != null ? data.exchangeRate : undefined,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          reference: data.reference ?? undefined,
          retentionAmount: data.retentionAmount ?? 0,
          adjustmentAmount: data.adjustmentAmount ?? 0,
          adjustmentNotes: data.adjustmentNotes ?? undefined,
        }
        if (!projectId) return
        const result = await createProjectTransaction(projectId, payload)
        if (result && 'error' in result && result.error) {
          const err = result.error as Record<string, string[]>
          if (err._form) toast.error(err._form[0])
          Object.entries(err).forEach(([field, msgs]) => {
            if (field !== '_form' && msgs?.[0])
              form.setError(field as keyof FormData, { message: msgs[0] })
          })
          return
        }
        const created = result && 'transaction' in result ? result.transaction : null
        if (created) {
          toast.success('Transacción creada')
          onSuccess(created as Record<string, unknown>)
        }
      }
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" style={{ maxWidth: '52rem' }} aria-describedby="transaction-form-desc">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Transacción' : 'Nueva Transacción'}
          </DialogTitle>
          <DialogDescription id="transaction-form-desc">
            {isEditing ? 'Modifica los datos de la transacción.' : 'Completa los datos para registrar una nueva transacción. Selecciona Proveedor en gastos/compras y Cliente en ingresos/ventas.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto pr-1">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(v) => {
                  form.setValue('type', v as FormData['type'])
                  form.setValue('partyId', null)
                }}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Gasto</SelectItem>
                  <SelectItem value="INCOME">Ingreso</SelectItem>
                  {!isCompanyLevel && (
                    <>
                      <SelectItem value="PURCHASE">Compra</SelectItem>
                      <SelectItem value="SALE">Venta</SelectItem>
                    </>
                  )}
                  <SelectItem value="OVERHEAD">Generales</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.type && (
                <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentType">Tipo de documento</Label>
              <Select
                value={form.watch('documentType') ?? 'INVOICE'}
                onValueChange={(v) => form.setValue('documentType', v as FormData['documentType'])}
              >
                <SelectTrigger id="documentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(showPartyAsSupplier || showPartyAsClient) && (
              <PartyCombobox
                label={showPartyAsSupplier ? 'Proveedor' : 'Cliente'}
                placeholder={showPartyAsSupplier ? 'Buscar proveedor...' : 'Buscar cliente...'}
                parties={parties}
                value={form.watch('partyId') ?? null}
                onChange={(id) => form.setValue('partyId', id)}
                id="partyId"
                allowCreate
                partyType={showPartyAsSupplier ? 'SUPPLIER' : 'CLIENT'}
                onCreateParty={async (name) => {
                  const partyType = showPartyAsSupplier ? 'SUPPLIER' : 'CLIENT'
                  const result = await createPartyForTransaction(partyType, name)
                  if (result && 'partyId' in result) {
                    setParties((prev) => [...prev, { id: result.partyId, name: result.name }])
                    return { id: result.partyId, name: result.name }
                  }
                  const err = result && 'error' in result ? result.error : 'No se pudo crear'
                  toast.error(err)
                  return { error: err }
                }}
              />
            )}
            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={form.watch('status') ?? 'DRAFT'}
                  onValueChange={(v) => form.setValue('status', v as FormData['status'])}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>{getStatusLabel(s, transaction?.type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Descripción de la transacción"
              className="min-h-[80px]"
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select
                value={form.watch('currency')}
                onValueChange={(v) => {
                  form.setValue('currency', v)
                  if (v === 'ARS') form.setValue('exchangeRate', undefined)
                }}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS ($)</SelectItem>
                  <SelectItem value="USD">USD (US$)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="CLP">CLP</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.watch('currency') !== 'ARS' && (
              <div className="space-y-2">
                <Label htmlFor="exchangeRate">Tipo de cambio (1 {form.watch('currency')} = X ARS)</Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  placeholder="Ej. 1050"
                  {...form.register('exchangeRate', { valueAsNumber: true })}
                />
                {form.formState.errors.exchangeRate && (
                  <p className="text-sm text-destructive">{form.formState.errors.exchangeRate.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Fecha de Emisión</Label>
              <Input
                id="issueDate"
                type="date"
                {...form.register('issueDate')}
              />
              {form.formState.errors.issueDate && (
                <p className="text-sm text-destructive">{form.formState.errors.issueDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register('dueDate')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                {...form.register('subtotal', { valueAsNumber: true })}
              />
              {form.formState.errors.subtotal && (
                <p className="text-sm text-destructive">{form.formState.errors.subtotal.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxTotal">Impuestos</Label>
              <Input
                id="taxTotal"
                type="number"
                step="0.01"
                {...form.register('taxTotal', { valueAsNumber: true })}
              />
              {form.formState.errors.taxTotal && (
                <p className="text-sm text-destructive">{form.formState.errors.taxTotal.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                readOnly
                {...form.register('total', { valueAsNumber: true })}
                className="bg-muted"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="retentionAmount">Retención (monto)</Label>
              <Input
                id="retentionAmount"
                type="number"
                step="0.01"
                min={0}
                {...form.register('retentionAmount', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustmentAmount">Ajuste (monto)</Label>
              <Input
                id="adjustmentAmount"
                type="number"
                step="0.01"
                {...form.register('adjustmentAmount', { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjustmentNotes">Notas de ajuste (opcional)</Label>
            <Input
              id="adjustmentNotes"
              {...form.register('adjustmentNotes')}
              placeholder="Motivo del ajuste"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Referencia (opcional)</Label>
            <Input
              id="reference"
              {...form.register('reference')}
              placeholder="Ej. número de OC (OC-0001) o nº de factura del proveedor para trazabilidad"
            />
          </div>

          {canAttach && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Adjuntos
                </Label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    disabled={attachUploading}
                    onChange={handleAttachFile}
                  />
                  <span className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                    {attachUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {attachUploading ? 'Subiendo...' : 'Adjuntar documento'}
                  </span>
                </label>
              </div>
              {attachmentLoading ? (
                <p className="text-sm text-muted-foreground">Cargando adjuntos...</p>
              ) : attachmentDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin adjuntos. Subí facturas o fotos desde el celular.</p>
              ) : (
                <ul className="space-y-1">
                  {attachmentDocs.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(d.versionId)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                      >
                        <FileDown className="h-4 w-4 shrink-0" />
                        <span className="truncate">{d.title || d.fileName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
