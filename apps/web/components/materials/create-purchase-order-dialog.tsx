'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { getMaterialsForPurchaseOrder, createPurchaseOrderCommitment } from '@/app/actions/materials'
import { getPartiesForProject } from '@/app/actions/finance'
import { formatCurrency } from '@/lib/format-utils'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { MaterialLineForPO } from '@/lib/types/materials'

interface CreatePurchaseOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  budgetVersionId: string
}

type SelectedLine = { line: MaterialLineForPO; quantity: number }

export function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
  projectId,
  budgetVersionId,
}: CreatePurchaseOrderDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [parties, setParties] = useState<{ id: string; name: string }[]>([])
  const [lines, setLines] = useState<MaterialLineForPO[]>([])
  const [partyId, setPartyId] = useState<string>('')
  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [selected, setSelected] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      getMaterialsForPurchaseOrder(budgetVersionId),
      getPartiesForProject(projectId, 'SUPPLIER'),
    ])
      .then(([poLines, suppliers]) => {
        setLines(poLines)
        setParties(suppliers)
        const initial: Record<string, number> = {}
        poLines.forEach((l) => {
          initial[l.budgetResourceId] = l.quantity
        })
        setSelected(initial)
        setPartyId('')
      })
      .catch(() => {
        toast.error('Error al cargar datos')
      })
      .finally(() => setLoading(false))
  }, [open, budgetVersionId, projectId])

  const toggleLine = (budgetResourceId: string, checked: boolean) => {
    const line = lines.find((l) => l.budgetResourceId === budgetResourceId)
    if (!line) return
    setSelected((prev) => {
      const next = { ...prev }
      if (checked) next[budgetResourceId] = line.quantity
      else delete next[budgetResourceId]
      return next
    })
  }

  const setQuantity = (budgetResourceId: string, quantity: number) => {
    const q = Math.max(0, quantity)
    setSelected((prev) => {
      const next = { ...prev }
      if (q > 0) next[budgetResourceId] = q
      else delete next[budgetResourceId]
      return next
    })
  }

  const selectedLines: SelectedLine[] = lines
    .filter((l) => selected[l.budgetResourceId] != null && selected[l.budgetResourceId] > 0)
    .map((l) => ({ line: l, quantity: selected[l.budgetResourceId] ?? 0 }))

  const totalAmount = selectedLines.reduce(
    (s, { line, quantity }) => s + quantity * line.unitCost,
    0
  )

  async function handleSubmit() {
    if (!partyId.trim()) {
      toast.error('Selecciona un proveedor')
      return
    }
    if (selectedLines.length === 0) {
      toast.error('Selecciona al menos una línea')
      return
    }
    setSubmitting(true)
    const result = await createPurchaseOrderCommitment({
      projectId,
      partyId,
      issueDate,
      description: `OC desde listado de materiales`,
      lines: selectedLines.map(({ line, quantity }) => ({
        wbsNodeId: line.wbsNodeId,
        description: line.description,
        unit: line.unit,
        quantity,
        unitPrice: line.unitCost,
      })),
    })
    setSubmitting(false)
    if (result.success) {
      toast.success(`Orden de compra ${result.commitmentNumber} creada`)
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir orden de compra</DialogTitle>
          <DialogDescription>
            Selecciona proveedor y las líneas (parcial o total) para crear la OC. Cada línea queda vinculada al ítem WBS para trazabilidad.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Proveedor</Label>
                <Select value={partyId} onValueChange={setPartyId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha de emisión</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Líneas (marca y ajusta cantidad para parcial/total)</Label>
              <div className="mt-2 max-h-[320px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Descripción</TableHead>
                      <TableHead>WBS</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">P. unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => {
                      const q = selected[line.budgetResourceId] ?? 0
                      const isSelected = q > 0
                      return (
                        <TableRow key={line.budgetResourceId}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(c) =>
                                toggleLine(line.budgetResourceId, !!c)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {line.description}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {line.wbsCode} {line.wbsName}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={q}
                              onChange={(e) =>
                                setQuantity(
                                  line.budgetResourceId,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="h-8 w-20 text-right"
                            />
                          </TableCell>
                          <TableCell>{line.unit}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(line.unitCost)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(q * line.unitCost)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {selectedLines.length > 0 && (
              <p className="text-sm font-medium tabular-nums text-foreground">
                Total: {formatCurrency(totalAmount)}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitting || selectedLines.length === 0 || !partyId}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Crear orden de compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
